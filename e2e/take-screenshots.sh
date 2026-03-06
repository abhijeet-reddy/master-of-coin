#!/bin/bash
# =============================================================================
# Screenshot Capture Script
# =============================================================================
# Usage:
#   ./e2e/take-screenshots.sh              # Take screenshots of all pages
#   ./e2e/take-screenshots.sh --update     # Update baseline screenshots
#
# Takes full-page screenshots of all major pages for visual verification.
# The agent can then view these screenshots using its vision capabilities.
# =============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
UPDATE_BASELINE=false

# Parse arguments
for arg in "$@"; do
  case $arg in
    --update)
      UPDATE_BASELINE=true
      shift
      ;;
  esac
done

echo "============================================"
echo "  Master of Coin — Screenshot Capture"
echo "============================================"

cd "$SCRIPT_DIR"

# Run smoke tests with screenshot tag
echo ""
echo "📸 Capturing screenshots of all pages..."
npx playwright test tests/smoke/smoke.spec.ts --grep "screenshot" || true

echo ""
echo "📸 Screenshots saved to: e2e/screenshots/actual/"
echo ""

# List captured screenshots
if [ -d "screenshots/actual" ]; then
  echo "Captured screenshots:"
  ls -la screenshots/actual/*.png 2>/dev/null || echo "  (no screenshots found)"
else
  echo "  (screenshots directory not found)"
fi

# Update baselines if requested
if [ "$UPDATE_BASELINE" = true ]; then
  echo ""
  echo "📸 Updating baseline screenshots..."
  if [ -d "screenshots/actual" ] && [ "$(ls -A screenshots/actual/*.png 2>/dev/null)" ]; then
    mkdir -p screenshots/baseline
    cp screenshots/actual/*.png screenshots/baseline/
    echo "✅ Baselines updated in screenshots/baseline/"
  else
    echo "❌ No actual screenshots to copy to baseline"
  fi
fi

echo ""
echo "============================================"
echo "  Done!"
echo "============================================"
