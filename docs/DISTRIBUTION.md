# Distributing TechTok

Two distribution stories now coexist, and this document covers both:

- **Phase 5, friends:** an installable Android APK via EAS internal
  distribution — no Play Store listing, no review process. One-time
  per-maintainer setup, then a link you can send.
- **Phase 23, public:** a Play Store AAB, built and submitted by CI. D67/D75
  retired D1's "me + friends" scope; the Play listing is now the target, and
  the friends APK survives as the `preview` channel alongside it.

Three build paths are supported, all on the Expo **free** tier:

- **Automated CI builds → GitHub Releases** (recommended, unmetered) — every push
  to `main` (and manual runs) builds an APK in GitHub Actions with
  `eas build --local` and attaches it to a GitHub Release. See
  [Automated CI builds](#automated-ci-builds-recommended) just below.
- **Manual EAS internal distribution** — `eas build` on Expo's cloud, quickest
  for a one-off link (spends your 15/mo free cloud-build credits). See
  [One-time setup](#one-time-setup-maintainer) below.
- **No-EAS local Gradle build for the Google Play Store** — see
  [Building & publishing without EAS](#building--publishing-without-eas-local-gradle--google-play)
  at the end.

## Automated CI builds (recommended)

`.github/workflows/mobile-build.yml` builds an installable Android APK on every
push to `main` that touches the app (and on manual **Run workflow**), then
attaches it to a **GitHub Release**. Friends install by downloading `techtok.apk`
from the release page — no Play Store, no per-build link to generate by hand.

### Why this dodges the free-tier build cap

The EAS free tier includes **15 Android + 15 iOS cloud builds/month**. The
workflow runs `eas build --local`, which compiles on the GitHub Actions runner
instead of Expo's cloud, so it **does not consume a cloud-build credit** —
effectively unlimited builds while staying on the free plan. (A plain `./gradlew`
build is unmetered the same way; we use the EAS recipe here so `eas.json`
profiles, env vars, and EAS-managed signing all apply.)

### One-time setup

1. **Expo account + access token.** Create a free account, then generate a
   personal access token at <https://expo.dev/settings/access-tokens>.
2. **GitHub secret.** Add it as the `EXPO_TOKEN` repository secret
   (Settings → Secrets and variables → Actions).
3. **Establish the Android keystore on EAS** (once), so CI can sign without a
   keystore in GitHub. From `apps/mobile/`:

   ```
   npx eas-cli credentials --platform android
   ```

   Pick the `preview` profile and let EAS generate/store a keystore. The build
   profile's `credentialsSource` defaults to `remote`, so `eas build --local`
   downloads it at build time using `EXPO_TOKEN`.

### Getting a build

- **Automatic:** merge to `main` (any change under `apps/mobile/`,
  `packages/shared/`, or the lockfile).
- **On demand:** GitHub → Actions → **Mobile build** → **Run workflow**.

The APK lands under the repo's **Releases** as `android-build-<run#>` (marked
pre-release). Send that release URL to a friend.

### Notes & fallbacks

- **Toolchain:** the job uses JDK 17 + the runner's Android SDK. Local EAS builds
  don't manage the SDK/NDK for you, so if a first run fails on a missing NDK, add
  an `sdkmanager "ndk;<version>"` step (the version is whatever the Expo SDK 57 /
  RN 0.86 Gradle config requests).
- **Local credentials instead of remote:** to avoid EAS-managed signing entirely,
  set `"credentialsSource": "local"` on the `preview` profile, commit a
  `credentials.json`, and have CI materialize the keystore from a base64 secret.
  That puts the keystore in GitHub secrets — the thing remote credentials avoid —
  so prefer the remote path above unless you have a reason.
- **iOS:** local iOS builds need a macOS runner (`macos-latest`) plus Apple
  signing assets; not wired up (project is Android-only, D12).

## One-time setup (maintainer)

1. `npx eas-cli login` (creates/uses an Expo account — free tier is enough).
2. ~~From `apps/mobile/`, run `npx eas-cli init` to link the project.~~ **Already
   done** — `app.json`'s `expo.extra.eas.projectId` is a real, committed
   value, and `expo-updates` is wired up (`updates.url` points at
   `u.expo.dev`). Only re-run `eas init` if the project is ever re-linked to
   a different Expo account/project.
3. Get the deployed production API URL (`aws apigatewayv2 get-apis --region
   eu-central-1 --query "Items[?Name=='techtok-production-Api'].ApiEndpoint"`
   or read it from the `sst deploy --stage production` CI log), then replace
   the placeholder `EXPO_PUBLIC_API_URL` (`https://your-api-id.execute-api.eu-central-1.amazonaws.com`)
   in both the `preview` and `production` profiles of `apps/mobile/eas.json`.
   This has been filled in for real before (pointing at what was then the
   `andrey`/`dev` stage) and reset back to a placeholder when that stage was
   renamed (D17) — don't assume the committed value is live without checking.

## Building an install link

```
cd apps/mobile
npx eas-cli build --platform android --profile preview
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

Most changes now reach already-installed apps on their own, no reinstall
needed (D60): every CI build (see [Automated CI
builds](#automated-ci-builds-recommended) above) publishes the same JS/asset
bundle it just compiled to the `preview` EAS Update channel. Installed apps
check that channel on every launch (`EXPO_UPDATES_CHECK_ON_LAUNCH=ALWAYS`)
and self-update in the background — friends see the change next time they
open TechTok.

This only covers **JS and asset changes**. Anything that touches native code
— a new native dependency, an `app.json` plugin/permission/icon change, an
Expo SDK bump — still needs a fresh APK: re-run the CI build (or `eas build`
manually) and re-share the install link, same as before OTA updates existed.

**Before any native-affecting change**, bump `runtimeVersion` by hand in both
`apps/mobile/app.json` and the generated
`apps/mobile/android/app/src/main/res/values/strings.xml`
(`expo_runtime_version`) — regenerate the latter via `pnpm prebuild:android`
and review the diff, or edit that one line directly. `runtimeVersion` isn't
recomputed automatically — the committed `android/` project (D18) has no
per-build prebuild step — so if it's left unbumped, the next OTA publish
would offer already-installed friends a JS bundle their native side doesn't
actually support.

## Rate limiting (Phase 5 review)

API Gateway HTTP APIs default to 5,000 requests/sec steady-state / 10,000
burst account-wide — far above anything a handful of friends' phones will
ever produce. `infra/api.ts` sets an explicit, much lower default
(`defaultRouteSettings`) as a sanity ceiling in case a client bug causes a
retry storm; per-device abuse prevention is explicitly out of scope at this
trust level (DESIGN §5).

## Automated CI builds for Google Play (recommended)

`.github/workflows/mobile-release.yml` builds the `production` `eas.json`
profile — an **AAB**, Play App Signing-ready — the same `eas build --local`
mechanism the friends-APK workflow above uses (unmetered, no EAS cloud-build
credit spent), just for the `production` profile instead of `preview`.

It **runs automatically** as the `mobile-play-release` job in `ci.yml`'s
main-branch pipeline (D98), on the same `should_build` gate as the preview APK
and **in parallel with it** (D99, which extracted the version bump into its own
`mobile-version-bump` job so neither build waits on the other).
`workflow_dispatch` stays available for an ad hoc rebuild. This reverses the
original design, which was dispatch-only on the reasoning that a Play
submission is a deliberate, infrequent action — D98 traded that for a pipeline
that keeps the internal track continuously current.

**This is the maintainer's actual build path — builds and deploys happen only
through CI, never `./gradlew`/`eas build` run by hand on a laptop.** The local
Gradle path documented below still works and stays as a fully-offline
fallback, but isn't what's used day to day.

### Getting a build

- **Automatic:** merge to `main` with a mobile-relevant change. The API URL is
  read from the **`PRODUCTION_API_URL` repository variable** (D100) — it is no
  longer passed by hand, which is what lets the mobile chain run in parallel
  with the backend `deploy-dev → e2e → deploy-production` chain instead of
  behind it.
- **On demand:** GitHub → Actions → **Mobile release (Play Store)** →
  **Run workflow**, passing the production API URL as `api_url`.

The run's **Artifacts** section carries `techtok-<run#>.aab`. **Submission to
Play's `internal` track is automatic once the `PlayServiceAccountKey` secret
exists** (D98 pulled this forward from phase 21); until it is set, the submit
step skips cleanly and the AAB stays a downloadable artifact you upload to Play
Console by hand.

### One-time setup

✅ **Done.** The `production` profile has its own EAS-managed signing
credentials, established separately from the `preview` profile's:

```
npx eas-cli credentials --platform android
```

Run it **from `apps/mobile/`, not the repo root** — from the root, `eas-cli`
doesn't find the real project and offers to create an unrelated new one.
Select the `production` profile and let EAS generate/store a keystore
remotely — no keystore file, no `keystore.properties`, matching the
CI-only build story. That keystore is the permanent Play upload key.

## Building & publishing without EAS (local Gradle → Google Play)

The repo keeps a committed native `android/` project (bare workflow, DESIGN §2
D18) so you *can* build and publish entirely with the standard Android
toolchain — no EAS, no Expo cloud build, no GitHub Actions. This is documented
as a fully-offline fallback; **it is not the path this maintainer uses** — see
[Automated CI builds for Google Play](#automated-ci-builds-for-google-play-recommended)
above for the one actually in use.

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
- `versionCode`/`versionName` in `android/app/build.gradle` are kept in sync
  automatically by CI — by the **`mobile-version-bump` job inside
  [ci.yml](../.github/workflows/ci.yml)**, which runs `scripts/bumpMobileVersion.ts`
  (there is no `mobile-version.yml` workflow file; D35's original one was
  retired and the logic moved, D41→D44, then extracted into its own job by
  D99). Every mobile-relevant merge to `main` bumps `app.json`'s canonical
  `version` from conventional-commit messages and propagates it here.
  **`versionCode` and `runtimeVersion` bump unconditionally on every native
  rebuild** (D101 — incrementing whatever is already in the tree, rather than
  deriving from the last `mobile-v*` tag), precisely because Play rejects a
  re-used `versionCode` even when the semver didn't move. Before uploading by
  hand, `git pull` and confirm `versionCode` has advanced since your last Play
  release; don't bump it manually unless the auto-bump genuinely hasn't run.

### Publishing to Google Play (first time)

1. ✅ Register a Play Console developer account (**$25 one-time fee**) —
   done, identity verification (KYC) passed.
2. Create the app. Its `applicationId` is `com.tormozz48dev.techtok` and can
   **never change** after the first upload — this is the final package name
   (D75b: keeping the `.dev` suffix was a deliberate call, not an oversight —
   it's visible only in the Play URL and Android's app-info screen, never in
   the listing itself, and a rename would cost an `expo prebuild`
   regeneration of the committed `android/` project for purely cosmetic gain).
3. Enable **Play App Signing** (Google-managed). Upload the `.aab` signed with
   your upload key; Google re-signs with the real key.
4. Complete the required forms: store listing, content rating, **Data safety**
   (the answer key, traced field-by-field to the code, is
   [docs/DATA_SAFETY.md](DATA_SAFETY.md)), target audience, and a **privacy
   policy URL** (mandatory) — `https://techtokapp.eu/privacy/`, served from
   `apps/site/src/pages/privacy.astro`. Play also wants a web
   account-deletion URL reachable without installing the app:
   `https://techtokapp.eu/delete-account/`.
5. Create a release on a track — start with **Internal testing** (instant, up to
   100 tester emails), then promote to Closed/Open/Production. Upload the `.aab`
   and roll out.

Subsequent releases (via the CI path above): nothing to dispatch — a
mobile-relevant merge to `main` builds the AAB and, once
`PlayServiceAccountKey` is set, submits it to the `internal` track on its own
(D98). Only if you are uploading by hand: `git pull`, confirm `versionCode`
has advanced (D101 bumps it on every native rebuild), then download the `.aab`
from the run's artifacts and upload it.

### Store listing assets

The **feature graphic** Play requires for the listing (1024×500, PNG/JPEG, max
15 MB) is committed at [apps/mobile/store/play/](../apps/mobile/store/play/) —
one per listing language (`en`/`ru`/`uk`/`pl`), each alongside the SVG it was
rendered from. Upload the matching language's PNG under **Main store listing →
Graphics** for each locale you publish.

Screenshots are *not* committed: Play wants real device captures, and this
repo's environment has no Android tooling. Capture at least two phone
screenshots on a device before the listing can be submitted.

### Caveats specific to this app

- **OTA updates** (`expo-updates`; `app.json` → `updates.url`) point at EAS
  Update. A non-EAS store build simply never fetches OTA updates — ship changes
  as new store builds. To drop the dependency entirely, remove the `updates`
  block and `expo-updates`.
- **No push notifications.** The Phase 5 daily-digest push feature
  (`expo-notifications`, an Expo-push-token field on `Users`, a settings
  toggle) was built, then fully retired end-to-end (D29) — there's nothing
  to configure here. If push is ever rebuilt, it would need its own FCM
  setup for a non-EAS build (register an FCM sender, `google-services.json`,
  hand the FCM key to Expo's push service) the same way this note used to
  describe.
