#!/usr/bin/env bash
#
# generate-blog-post.sh
# Generates a weekly blog post draft from recent git activity.
# Parses conventional commits and groups them by type.
#
# Usage:
#   ./scripts/generate-blog-post.sh [--days N] [--output DIR]
#
# Options:
#   --days N       Number of days to look back (default: 7)
#   --output DIR   Output directory (default: scripts/blog-drafts)

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DAYS=7
OUTPUT_DIR="$REPO_ROOT/scripts/blog-drafts"

# Parse arguments
while [[ $# -gt 0 ]]; do
  case "$1" in
    --days)   DAYS="$2"; shift 2 ;;
    --output) OUTPUT_DIR="$2"; shift 2 ;;
    *)        echo "Unknown option: $1"; exit 1 ;;
  esac
done

mkdir -p "$OUTPUT_DIR"

TODAY=$(date +%Y-%m-%d)
SINCE=$(date -d "$DAYS days ago" +%Y-%m-%d 2>/dev/null || date -v-${DAYS}d +%Y-%m-%d)
SLUG="weekly-update-${TODAY}"

# Month names for title
MONTH_NAME=$(date +%B)
DAY_NUM=$(date +%-d)
YEAR=$(date +%Y)
TITLE_DATE="${MONTH_NAME} ${DAY_NUM}, ${YEAR}"

# Collect commits
COMMITS=$(cd "$REPO_ROOT" && git log --since="$SINCE" --pretty=format:"%H|%s|%an|%ai" --no-merges 2>/dev/null || true)

if [[ -z "$COMMITS" ]]; then
  echo "No commits found in the last $DAYS days."
  exit 0
fi

# Classify a commit message into a type
classify_type() {
  local msg="$1"
  case "$msg" in
    feat:*|feat\(*) echo "feat" ;;
    fix:*|fix\(*)   echo "fix" ;;
    docs:*|docs\(*) echo "docs" ;;
    refactor:*|refactor\(*) echo "refactor" ;;
    test:*|test\(*) echo "test" ;;
    chore:*|chore\(*) echo "chore" ;;
    perf:*|perf\(*) echo "perf" ;;
    ci:*|ci\(*)     echo "ci" ;;
    style:*|style\(*) echo "style" ;;
    revert:*|revert\(*) echo "revert" ;;
    *)
      # Try to detect type from message content
      local lower="${msg,,}"
      if [[ "$lower" == *"add "* || "$lower" == *"new "* || "$lower" == *"implement"* || "$lower" == *"support"* ]]; then
        echo "feat"
      elif [[ "$lower" == *"fix "* || "$lower" == *"resolve"* || "$lower" == *"correct"* || "$lower" == *"patch"* ]]; then
        echo "fix"
      elif [[ "$lower" == *"doc"* || "$lower" == *"readme"* ]]; then
        echo "docs"
      elif [[ "$lower" == *"refactor"* || "$lower" == *"clean"* || "$lower" == *"restructur"* ]]; then
        echo "refactor"
      elif [[ "$lower" == *"seo"* || "$lower" == *"i18n"* || "$lower" == *"translat"* ]]; then
        echo "other"
      else
        echo "other"
      fi
      ;;
  esac
}

# Strip conventional commit prefix from message
strip_prefix() {
  local msg="$1"
  echo "$msg" | sed -E 's/^(feat|fix|docs|refactor|test|chore|perf|ci|style|revert)(\([^)]*\))?:\s*//'
}

# Collect commits by type
declare -A TYPE_COMMITS
declare -a ALL_TYPES=("feat" "fix" "docs" "refactor" "chore" "perf" "other")

for t in "${ALL_TYPES[@]}"; do
  TYPE_COMMITS[$t]=""
done

TOTAL_COUNT=0

while IFS='|' read -r hash msg author date_str; do
  [[ -z "$hash" ]] && continue
  ctype=$(classify_type "$msg")
  clean_msg=$(strip_prefix "$msg")
  # Escape special JSON characters
  clean_msg=$(echo "$clean_msg" | sed 's/\\/\\\\/g; s/"/\\"/g')
  TYPE_COMMITS[$ctype]+="- ${clean_msg}\n"
  TOTAL_COUNT=$((TOTAL_COUNT + 1))
done <<< "$COMMITS"

# Estimate read time (~1 min per 5 items, minimum 3)
READ_MINS=$(( (TOTAL_COUNT / 5) + 3 ))
[[ $READ_MINS -gt 15 ]] && READ_MINS=15

# Build the markdown body sections
build_section() {
  local label="$1"
  local type_key="$2"
  local items="${TYPE_COMMITS[$type_key]}"
  if [[ -n "$items" ]]; then
    echo "### ${label}"
    echo ""
    echo -e "$items"
  fi
}

BODY=""

section=$(build_section "New Features" "feat")
[[ -n "$section" ]] && BODY+="${section}\n"

section=$(build_section "Bug Fixes" "fix")
[[ -n "$section" ]] && BODY+="${section}\n"

section=$(build_section "Documentation" "docs")
[[ -n "$section" ]] && BODY+="${section}\n"

section=$(build_section "Refactoring" "refactor")
[[ -n "$section" ]] && BODY+="${section}\n"

section=$(build_section "Performance" "perf")
[[ -n "$section" ]] && BODY+="${section}\n"

section=$(build_section "Maintenance" "chore")
[[ -n "$section" ]] && BODY+="${section}\n"

section=$(build_section "Other Changes" "other")
[[ -n "$section" ]] && BODY+="${section}\n"

# Build a short description from the top items
FEAT_COUNT=0
FIX_COUNT=0
OTHER_COUNT=0
[[ -n "${TYPE_COMMITS[feat]}" ]] && FEAT_COUNT=$(echo -e "${TYPE_COMMITS[feat]}" | grep -c "^-" || true)
[[ -n "${TYPE_COMMITS[fix]}" ]] && FIX_COUNT=$(echo -e "${TYPE_COMMITS[fix]}" | grep -c "^-" || true)
OTHER_COUNT=$((TOTAL_COUNT - FEAT_COUNT - FIX_COUNT))

DESC_PARTS=()
[[ $FEAT_COUNT -gt 0 ]] && DESC_PARTS+=("${FEAT_COUNT} new features")
[[ $FIX_COUNT -gt 0 ]] && DESC_PARTS+=("${FIX_COUNT} bug fixes")
[[ $OTHER_COUNT -gt 0 ]] && DESC_PARTS+=("${OTHER_COUNT} other improvements")

DESCRIPTION=$(IFS=', '; echo "${DESC_PARTS[*]}")

FULL_BODY="## What's New This Week\\n\\nHere's a summary of ${TOTAL_COUNT} changes from the past ${DAYS} days.\\n\\n${BODY}"

# Build tags array
TAGS='"changelog", "weekly-update"'
[[ $FEAT_COUNT -gt 0 ]] && TAGS+=', "new-features"'
[[ $FIX_COUNT -gt 0 ]] && TAGS+=', "bug-fixes"'

# Escape the body for JSON (newlines become literal \n)
JSON_BODY=$(echo -e "$FULL_BODY" | sed ':a;N;$!ba;s/\n/\\n/g' | sed 's/\t/\\t/g')

# Generate the output JSON
OUTPUT_FILE="${OUTPUT_DIR}/${SLUG}.json"

cat > "$OUTPUT_FILE" << ENDJSON
{
  "slug": "${SLUG}",
  "date": "${TODAY}",
  "readTime": "${READ_MINS} min",
  "tags": [${TAGS}],
  "en": {
    "title": "Weekly Update — ${TITLE_DATE}",
    "description": "This week's highlights: ${DESCRIPTION}.",
    "body": "${JSON_BODY}"
  }
}
ENDJSON

# Validate JSON
if command -v python3 &>/dev/null; then
  if ! python3 -c "import json; json.load(open('${OUTPUT_FILE}'))" 2>/dev/null; then
    echo "Warning: Generated JSON may have formatting issues. Please review manually."
  fi
fi

echo "Blog post draft generated: ${OUTPUT_FILE}"
echo "  Period: ${SINCE} to ${TODAY} (${DAYS} days)"
echo "  Commits: ${TOTAL_COUNT}"
echo "  Features: ${FEAT_COUNT}, Fixes: ${FIX_COUNT}, Other: ${OTHER_COUNT}"
echo ""
echo "Next steps:"
echo "  1. Review and edit the draft"
echo "  2. Add translations for all 7 languages (tr, es, de, zh, it, ja)"
echo "  3. Add the post to frontend/app/blog/page.tsx and frontend/app/blog/[slug]/page.tsx"
