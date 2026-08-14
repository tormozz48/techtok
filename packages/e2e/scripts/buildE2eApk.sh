#!/usr/bin/env bash
set -euo pipefail

# Builds apps/mobile as a debug APK with the Maestro E2E sign-in bypass
# enabled (EXPO_PUBLIC_E2E_AUTH=1 — see apps/mobile/src/state/e2eAuth.ts) and
# pointed at a real, deployed API stage.
#
# Debug (faster: no minify/resource-shrink, unoptimized native compile), but
# with -Pandroid.debuggableVariants= so the JS bundle still gets embedded
# (see app/build.gradle) — self-contained, no Metro process needed for the
# whole suite run, same as a release build would be. Signed with the
# checked-in debug.keystore (app/build.gradle), so no signing setup needed.
#
# Requires: AWS credentials for the target stage (to discover its API
# endpoint the same way the HTTP-level E2E suites do), and a JDK + Android
# SDK on PATH (ANDROID_HOME or the default ~/Library/Android/sdk).
#
# Env overrides:
#   TECHTOK_E2E_STAGE     — stage to discover the API endpoint from (default: dev)
#   TECHTOK_E2E_API_URL   — skip discovery and use this endpoint directly (CI
#                           passes its own already-discovered value so the same
#                           URL feeds both the cache key and the build)
#   TECHTOK_E2E_ARCH      — overrides reactNativeArchitectures (gradle.properties
#                           defaults to arm64-v8a, this machine's local AVD ABI;
#                           CI's x86_64 emulator needs `x86_64` here instead)

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
cd "$REPO_ROOT"

export ANDROID_HOME="${ANDROID_HOME:-$HOME/Library/Android/sdk}"
export ANDROID_SDK_ROOT="${ANDROID_SDK_ROOT:-$ANDROID_HOME}"

# The Android Gradle Plugin bundled with this Expo/RN version needs JDK 17 —
# newer JDKs (tried 25/26 here) fail `jlink`ing core-for-system-modules.jar
# for the native modules' androidJdkImage transform. Prefer a discovered
# JDK 17 over whatever `java` resolves to on PATH.
if [ -z "${JAVA_HOME:-}" ] || ! "${JAVA_HOME}/bin/java" -version 2>&1 | grep -q '"17\.'; then
  if [ -x /opt/homebrew/opt/openjdk@17/bin/java ]; then
    export JAVA_HOME=/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home
  elif command -v /usr/libexec/java_home >/dev/null 2>&1 && /usr/libexec/java_home -v 17 >/dev/null 2>&1; then
    export JAVA_HOME="$(/usr/libexec/java_home -v 17)"
  else
    echo "No JDK 17 found. Install one, e.g.: brew install openjdk@17" >&2
    exit 1
  fi
fi
echo "==> Using JAVA_HOME=${JAVA_HOME}"

STAGE="${TECHTOK_E2E_STAGE:-dev}"

if [ -n "${TECHTOK_E2E_API_URL:-}" ]; then
  API_URL="$TECHTOK_E2E_API_URL"
  echo "==> Using pre-discovered API endpoint: ${API_URL}"
else
  echo "==> Discovering the '${STAGE}' stage API endpoint..."
  API_URL="$(pnpm exec tsx packages/e2e/scripts/discoverApiUrl.ts "$STAGE")"
  echo "==> API endpoint: ${API_URL}"
fi

export EXPO_PUBLIC_E2E_AUTH=1
export EXPO_PUBLIC_API_URL="$API_URL"

GRADLE_ARGS=(assembleDebug -Pandroid.debuggableVariants=)
if [ -n "${TECHTOK_E2E_ARCH:-}" ]; then
  GRADLE_ARGS+=(-PreactNativeArchitectures="$TECHTOK_E2E_ARCH")
fi

echo "==> Building E2E APK (assembleDebug, JS bundle embedded)..."
(cd apps/mobile/android && ./gradlew "${GRADLE_ARGS[@]}")

APK_PATH="apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk"
if [ ! -f "$APK_PATH" ]; then
  echo "Build finished but no APK found at ${APK_PATH}" >&2
  exit 1
fi

echo "==> Built: ${APK_PATH}"
