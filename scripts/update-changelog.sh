#!/usr/bin/env bash
#
# update-changelog.sh
# Regenerates frontend/public/changelog-data.json from git log.
# Reads the last N commits, classifies them by conventional commit type,
# and outputs valid JSON matching the existing changelog format.
#
# Usage:
#   ./scripts/update-changelog.sh [--count N]
#
# Options:
#   --count N   Number of commits to include (default: 100)

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
COUNT=100000
OUTPUT_FILE="$REPO_ROOT/frontend/public/changelog-data.json"

# Parse arguments
while [[ $# -gt 0 ]]; do
  case "$1" in
    --count) COUNT="$2"; shift 2 ;;
    *)       echo "Unknown option: $1"; exit 1 ;;
  esac
done

# Classify a commit message into a type based on conventional commit prefix
classify_type() {
  local msg="$1"
  case "$msg" in
    feat:*|feat\(*)         echo "feat" ;;
    fix:*|fix\(*)           echo "fix" ;;
    docs:*|docs\(*)         echo "docs" ;;
    refactor:*|refactor\(*) echo "refactor" ;;
    test:*|test\(*)         echo "test" ;;
    chore:*|chore\(*)       echo "chore" ;;
    perf:*|perf\(*)         echo "perf" ;;
    ci:*|ci\(*)             echo "ci" ;;
    style:*|style\(*)       echo "style" ;;
    revert:*|revert\(*)     echo "revert" ;;
    *)
      local lower="${msg,,}"
      if [[ "$lower" == *"add "* || "$lower" == *"new "* || "$lower" == *"implement"* || "$lower" == *"support"* ]]; then
        echo "feat"
      elif [[ "$lower" == *"fix "* || "$lower" == *"resolve"* || "$lower" == *"correct"* || "$lower" == *"patch"* ]]; then
        echo "fix"
      elif [[ "$lower" == *"doc"* || "$lower" == *"readme"* ]]; then
        echo "docs"
      elif [[ "$lower" == *"refactor"* || "$lower" == *"clean"* || "$lower" == *"restructur"* ]]; then
        echo "refactor"
      else
        echo "other"
      fi
      ;;
  esac
}

# Strip the conventional commit prefix from the message for clean display
strip_prefix() {
  local msg="$1"
  echo "$msg" | sed -E 's/^(feat|fix|docs|refactor|test|chore|perf|ci|style|revert)(\([^)]*\))?:\s*//'
}

# Collect commits
COMMITS=$(cd "$REPO_ROOT" && git log -n "$COUNT" --pretty=format:"%h|%s|%an|%ai" --no-merges)

if [[ -z "$COMMITS" ]]; then
  echo "No commits found."
  echo "[]" > "$OUTPUT_FILE"
  exit 0
fi

# Build JSON array using python for reliable JSON encoding
python3 << 'PYEOF' - "$COMMITS" "$OUTPUT_FILE"
import sys
import json

raw_input = sys.argv[1]
output_file = sys.argv[2]

def classify_type(msg):
    lower = msg.lower()
    prefixes = {
        'feat': 'feat', 'fix': 'fix', 'docs': 'docs',
        'refactor': 'refactor', 'test': 'test', 'chore': 'chore',
        'perf': 'perf', 'ci': 'ci', 'style': 'style', 'revert': 'revert'
    }
    for prefix, typ in prefixes.items():
        if lower.startswith(prefix + ':') or lower.startswith(prefix + '('):
            return typ

    if any(w in lower for w in ['add ', 'new ', 'implement', 'support']):
        return 'feat'
    if any(w in lower for w in ['fix ', 'resolve', 'correct', 'patch']):
        return 'fix'
    if any(w in lower for w in ['doc', 'readme']):
        return 'docs'
    if any(w in lower for w in ['refactor', 'clean', 'restructur']):
        return 'refactor'
    return 'other'

import re
def strip_prefix(msg):
    return re.sub(r'^(feat|fix|docs|refactor|test|chore|perf|ci|style|revert)(\([^)]*\))?\s*:\s*', '', msg)

entries = []
for line in raw_input.strip().split('\n'):
    if not line.strip():
        continue
    parts = line.split('|', 3)
    if len(parts) < 4:
        continue
    short_hash, message, author, date_str = parts
    # Extract just the date portion (YYYY-MM-DD)
    date_only = date_str.strip()[:10]
    clean_msg = strip_prefix(message)
    ctype = classify_type(message)

    entries.append({
        "hash": short_hash.strip(),
        "short": short_hash.strip(),
        "message": clean_msg,
        "date": date_only,
        "author": author.strip(),
        "type": ctype
    })

with open(output_file, 'w', encoding='utf-8') as f:
    json.dump(entries, f, indent=2, ensure_ascii=False)

print(f"Changelog updated: {output_file}")
print(f"  Total commits: {len(entries)}")
type_counts = {}
for e in entries:
    type_counts[e['type']] = type_counts.get(e['type'], 0) + 1
for t, c in sorted(type_counts.items(), key=lambda x: -x[1]):
    print(f"  {t}: {c}")
PYEOF
