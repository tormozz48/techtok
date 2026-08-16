#!/usr/bin/env bash
set -euo pipefail

# Runs the Maestro mobile E2E suite (packages/e2e/maestro/flows) against
# whatever device/emulator `adb` currently sees.
#
# Mints a real Google ID token for the dedicated E2E test account (the same
# GOOGLE_TEST_REFRESH_TOKEN exchange apiContract.test.ts's authenticated
# suites already use) and hands it to Maestro as an env var; every flow's
# shared `_signIn.yaml` subflow deep-links it into the app's sign-in bypass
# (apps/mobile/src/state/e2eAuth.ts) instead of driving Google's own
# (automation-resistant) consent UI. AWS calls the app makes afterward are
# 100% real — API Gateway's JWT authorizer still verifies this token on
# every request.
#
# Requires:
#   - scripts/buildE2eApk.sh already run, and its APK installed on the
#     target device/emulator (`adb install -r <apk>`)
#   - the Maestro CLI on PATH: curl -Ls "https://get.maestro.mobile.dev" | bash
#   - GOOGLE_TEST_REFRESH_TOKEN / GOOGLE_OAUTH_WEB_CLIENT_ID /
#     GOOGLE_OAUTH_WEB_CLIENT_SECRET set (see src/googleTestAuth.ts) — exits
#     early with the same "not provisioned" message as the HTTP suite's
#     describe.skipIf if they're missing, rather than failing deep into a run
#
# Usage: scripts/runMobileE2e.sh [maestro flow file or dir, default: all flows]

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
cd "$REPO_ROOT"

APP_ID="com.tormozz48dev.techtok"
TARGET="${1:-packages/e2e/maestro/flows}"

if ! command -v maestro >/dev/null 2>&1; then
  echo "Maestro CLI not found on PATH. Install: curl -Ls \"https://get.maestro.mobile.dev\" | bash" >&2
  exit 1
fi

echo "==> Minting a Google ID token for the E2E test account..."
ID_TOKEN="$(pnpm exec tsx packages/e2e/scripts/mintIdToken.ts)"

echo "==> Running Maestro flows: ${TARGET}"
maestro test "$TARGET" -e APP_ID="$APP_ID" -e ID_TOKEN="$ID_TOKEN"
