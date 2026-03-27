#!/bin/bash
# Build pixel-office and auto-update index.html with new bundle hash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
PIXEL_SRC="$PROJECT_ROOT/frontend/pixel-agents/webview-ui"
PIXEL_PUBLIC="$PROJECT_ROOT/frontend/public/pixel-office"

echo "🔨 Building pixel-office..."
cd "$PIXEL_SRC"
npx tsc --noEmit
npx vite build

# Find the new bundle files
DIST_DIR="$PIXEL_SRC/../dist/webview"
NEW_JS=$(ls "$DIST_DIR/assets"/index-*.js 2>/dev/null | head -1)
NEW_CSS=$(ls "$DIST_DIR/assets"/index-*.css 2>/dev/null | head -1)

if [ -z "$NEW_JS" ]; then
  echo "❌ No JS bundle found in dist"
  exit 1
fi

JS_NAME=$(basename "$NEW_JS")
CSS_NAME=$(basename "$NEW_CSS")

echo "📦 New bundle: $JS_NAME"

# Clean old bundles from public
rm -f "$PIXEL_PUBLIC/assets"/index-*.js
rm -f "$PIXEL_PUBLIC/assets"/index-*.css

# Copy new bundles
cp "$NEW_JS" "$PIXEL_PUBLIC/assets/"
cp "$NEW_CSS" "$PIXEL_PUBLIC/assets/"

# Copy browserMock if exists
for f in "$DIST_DIR/assets"/browserMock-*.js; do
  [ -f "$f" ] && cp "$f" "$PIXEL_PUBLIC/assets/"
done

# Update index.html with new bundle names
sed -i.bak "s|src=\"\./assets/index-[^\"]*\.js\"|src=\"./assets/$JS_NAME\"|" "$PIXEL_PUBLIC/index.html"
sed -i.bak "s|href=\"\./assets/index-[^\"]*\.css\"|href=\"./assets/$CSS_NAME\"|" "$PIXEL_PUBLIC/index.html"
rm -f "$PIXEL_PUBLIC/index.html.bak"

echo "✅ Pixel office built and deployed"
echo "   JS:  $JS_NAME"
echo "   CSS: $CSS_NAME"
