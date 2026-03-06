#!/bin/bash
# =============================================================================
# E2E Test Verification Script
# =============================================================================
# Usage:
#   ./e2e/verify.sh                    # Run all tests
#   ./e2e/verify.sh tests/smoke/       # Run only smoke tests
#   ./e2e/verify.sh tests/auth/        # Run only auth tests
#   ./e2e/verify.sh --skip-build       # Skip Docker rebuild (faster)
#
# This script:
# 1. Rebuilds the Docker stack (unless --skip-build)
# 2. Waits for the app to be healthy
# 3. Runs Playwright E2E tests
# 4. Reports results
# =============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
SKIP_BUILD=false
TEST_PATH=""

# Parse arguments
for arg in "$@"; do
  case $arg in
    --skip-build)
      SKIP_BUILD=true
      shift
      ;;
    *)
      TEST_PATH="$arg"
      shift
      ;;
  esac
done

echo "============================================"
echo "  Master of Coin — E2E Test Runner"
echo "============================================"

# Step 1: Rebuild Docker (unless skipped)
if [ "$SKIP_BUILD" = false ]; then
  echo ""
  echo "🐳 Step 1: Rebuilding Docker stack..."
  cd "$PROJECT_DIR"
  docker-compose down 2>/dev/null || true
  docker-compose build
  docker-compose up -d
  echo "✅ Docker stack started"
else
  echo ""
  echo "⏭️  Step 1: Skipping Docker rebuild (--skip-build)"
fi

# Step 2: Wait for app to be healthy
echo ""
echo "⏳ Step 2: Waiting for app to be healthy..."
for i in $(seq 1 30); do
  if curl -s http://localhost:13153/health > /dev/null 2>&1; then
    echo "✅ App is healthy!"
    break
  fi
  if [ "$i" -eq 30 ]; then
    echo "❌ App did not become healthy after 60 seconds"
    echo "   Check Docker logs: docker-compose logs server"
    exit 1
  fi
  echo "   Waiting... ($i/30)"
  sleep 2
done

# Step 3: Run E2E tests
echo ""
echo "🧪 Step 3: Running E2E tests..."
cd "$SCRIPT_DIR"

if [ -n "$TEST_PATH" ]; then
  echo "   Running: npx playwright test $TEST_PATH"
  npx playwright test "$TEST_PATH"
else
  echo "   Running: npx playwright test"
  npx playwright test
fi

# Step 4: Report
echo ""
echo "============================================"
echo "  ✅ E2E Tests Complete!"
echo "============================================"
echo ""
echo "📸 Screenshots saved to: e2e/screenshots/actual/"
echo "📊 Test report: cd e2e && npx playwright show-report"
echo ""
