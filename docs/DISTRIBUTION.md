# Distributing TechTok to friends (Phase 5)

TechTok is distributed as an installable Android APK via EAS internal
distribution — no Play Store listing, no review process. This is a one-time
per-maintainer setup, then a link you can send.

There are two supported paths: **EAS internal distribution** (below — quickest
for handing friends an APK), and a **no-EAS local Gradle build for the Google
Play Store** (see [Building & publishing without EAS](#building--publishing-without-eas-local-gradle--google-play)
at the end).

## One-time setup (maintainer)

1. `npx eas login` (creates/uses an Expo account — free tier is enough).
2. From `apps/mobile/`, run `npx eas init` to link the project; this writes a
   real `projectId` into `app.json` under `expo.extra.eas`.
3. Get the deployed production API URL (`aws apigatewayv2 get-apis --region
   eu-central-1 --query "Items[?Name=='techtok-production-Api'].ApiEndpoint"`
   or read it from the `sst deploy --stage production` CI log), then replace
   `REPLACE_WITH_PRODUCTION_API_URL` in both the `preview` and `production`
   profiles of `apps/mobile/eas.json`.

## Building an install link

```
cd apps/mobile
npx eas build --platform android --profile preview
```

This uploads a build to Expo's servers and prints a page URL
(`https://expo.dev/accounts/<you>/projects/techtok/builds/<id>`) — that page
has a QR code and a direct APK download link. Send either to a friend.

## Installing (friend's phone)

1. Open the link on the phone (not a desktop — the QR code is for scanning
   *from* a phone you're not already on).
2. Tap the download button; Android will warn about installing from an
   unknown source — allow it for this file only.
3. Open the app. It generates its own device ID on first launch, so each
   friend automatically gets independent read state and topic prefs
   (DESIGN §5, `X-Device-Id`) — no account needed.

## Updating an install

Re-run the same `eas build` command and re-share the new build's link.
There's no auto-update; friends re-download when you tell them there's a new
build.

## Rate limiting (Phase 5 review)

API Gateway HTTP APIs default to 5,000 requests/sec steady-state / 10,000
burst account-wide — far above anything a handful of friends' phones will
ever produce. `infra/api.ts` sets an explicit, much lower default
(`defaultRouteSettings`) as a sanity ceiling in case a client bug causes a
retry storm; per-device abuse prevention is explicitly out of scope at this
trust level (DESIGN §5).

## Building & publishing without EAS (local Gradle → Google Play)

The repo keeps a committed native `android/` project (bare workflow, DESIGN §2
D18) so you can build and publish entirely with the standard Android toolchain —
no EAS, no Expo cloud build. Use this path for the Google Play Store. The EAS
path above still works and is kept as a fallback.

### Prerequisites (one time, maintainer machine)

- **JDK 17** and the **Android SDK** (Android Studio, or `sdkmanager`); set
  `ANDROID_HOME` / `ANDROID_SDK_ROOT`.
- An **upload keystore**. With Google Play App Signing, Google holds the real
  signing key and this is only your *upload* key — recoverable if lost:

  ```
  keytool -genkeypair -v -keystore ~/keys/techtok-upload.keystore -alias techtok -keyalg RSA -keysize 2048 -validity 10000
  ```

  Keep the file **outside** the repo. Then copy
  `apps/mobile/android/keystore.properties.example` →
  `apps/mobile/android/keystore.properties` (gitignored) and fill in the
  absolute `storeFile` path and passwords. `android/app/build.gradle` reads this
  for the `release` signing config and falls back to the debug key when absent.

### Regenerating the native project

`android/` is committed, so you normally don't touch it. If you change
`app.json` (icons, plugins, package name) or bump the Expo SDK, regenerate and
review the diff:

```
cd apps/mobile && pnpm prebuild:android
```

Signing is external (`keystore.properties`), so it survives regeneration.

### Building the release artifact

The release JS bundle embeds `EXPO_PUBLIC_API_URL` from `apps/mobile/.env` (or
the shell env). Make sure it points to the **production** API before a store
build.

```
cd apps/mobile && pnpm build:android
```

- Output: `apps/mobile/android/app/build/outputs/bundle/release/app-release.aab`
  (an **AAB**, which is what Play requires for new apps).
- `pnpm build:android:apk` instead produces a sideloadable APK for quick device
  testing (not for Play).
- Bump `versionCode` (and `versionName`) in `android/app/build.gradle` before
  **every** Play upload — Play rejects a re-used `versionCode`.

### Publishing to Google Play (first time)

1. Register a Play Console developer account (**$25 one-time fee**).
2. Create the app. Its `applicationId` is `com.tormozz48dev.techtok` and can
   **never change** after the first upload — pick the final package name now (the
   `.dev` suffix is dev-only; decide before publishing).
3. Enable **Play App Signing** (Google-managed). Upload the `.aab` signed with
   your upload key; Google re-signs with the real key.
4. Complete the required forms: store listing, content rating, **Data safety**,
   target audience, and a **privacy policy URL** (mandatory).
5. Create a release on a track — start with **Internal testing** (instant, up to
   100 tester emails), then promote to Closed/Open/Production. Upload the `.aab`
   and roll out.

Subsequent releases: bump `versionCode`, `pnpm build:android`, upload the new
`.aab`.

### Caveats specific to this app

- **OTA updates** (`expo-updates`; `app.json` → `updates.url`) point at EAS
  Update. A non-EAS store build simply never fetches OTA updates — ship changes
  as new store builds. To drop the dependency entirely, remove the `updates`
  block and `expo-updates`.
- **Push notifications** (`expo-notifications`, the Phase 5 digest) need FCM
  credentials for Android delivery. EAS normally uploads these for you; off EAS
  you register an FCM sender (`google-services.json`) and give the FCM key to
  Expo's push service (the backend still sends via the Expo Push API). Only
  relevant once the digest push is turned on.
