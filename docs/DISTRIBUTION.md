# Distributing TechTok

TechTok ships to Android through **Google Play**. Every mobile-relevant merge
to `main` builds two artifacts in CI, both pointed at the production API:

- an **AAB** (`eas.json` `production` profile), published to Play's
  **`internal`** track and its **`alpha`** closed-testing track (D98, D116) —
  what testers install;
- an **APK** (`preview` profile), attached to a GitHub Release for
  sideloading.

Either way, the app needs a Google account: sign-in is mandatory (D68).
Builds happen only in [CI](#ci-builds), never on a laptop; the local Gradle
path at the end of this document is an offline fallback, not the one in use.

## Installing as a tester (Google Play closed test)

Testers enroll through the public Google Group
**`techtok-testers@googlegroups.com`**, which is the `alpha` track's tester
list (D115). [techtokapp.eu/test/](https://techtokapp.eu/test/) walks them
through these steps in all four languages, with a button and a QR code for
each link; the landing page shows the same QR codes.

1. On the Android phone, open <https://groups.google.com/g/techtok-testers>
   signed in with the phone's Google account and tap **Join group**. Only
   group members can join the test.
2. Open the Play testing invitation,
   <https://play.google.com/apps/testing/com.tormozz48dev.techtok>, and accept
   it.
3. Install TechTok from its Play Store page. Play delivers updates from then
   on.
4. Open the app and **sign in with Google** — there is no anonymous mode.
   Every API route except `GET /v1/topics` and `GET /v1/sources` requires a
   Google ID token, and read state, bookmarks, topic preferences, muted
   sources, language and plan are all keyed to the Google account
   (`users.external_id = "g:" + sub`, DESIGN §5), so they carry over to
   another phone or a reinstall. Signing out clears the app's cached data and
   locally stored preferences, except the theme and haptics settings.

Maintainer notes:

- The track takes the group *instead of* Play Console's tester email lists —
  the two are mutually exclusive — so anyone still on an email list has to
  join the group to stay in the test.
- Tester-list changes made in Play Console take effect only once they're sent
  for review from **Publishing overview**.
- Anyone can find and join the group, but only owners can post or see the
  member list, so testers never see each other's addresses.
- Play won't open production to a personal developer account until at least
  12 testers have stayed opted in for 14 consecutive days (D75); this closed
  test is how that requirement gets met.

## Installing the sideloaded APK

The newest APK is always at
<https://github.com/tormozz48/techtok/releases/latest/download/techtok.apk>.
Open that link on the phone, allow installs from unknown sources when Android
asks, then sign in with Google as above.

- **It can't coexist with the Play install.** Both use the application ID
  `com.tormozz48dev.techtok` but different signing certificates — the APK is
  signed with the `preview` profile's EAS keystore, Play installs with Play's
  app-signing key — so Android won't install one over the other. Uninstall
  first; nothing is lost, since the account's data lives server-side.
- **Sign-in depends on that certificate.** Google Sign-In works in the APK
  only if the `preview` keystore's SHA-1 is registered on the Android OAuth
  client too (D68).
- **It doesn't update itself** — see below.

## Updating an install

- **Play installs** update through Play: every mobile-relevant merge lands a
  new build on `internal` right away and on `alpha` once Play's review
  passes. Nothing publishes to the `production` EAS Update channel, so
  there are no over-the-air updates on top of that.
- **The sideloaded APK** updates only by installing a newer APK from the link
  above. `mobile-build` does publish each build's JS bundle to the `preview`
  EAS Update channel, but an update only reaches installs with the same
  `runtimeVersion`, and `mobile-version-bump` raises `runtimeVersion` on
  every run — so each bundle matches only the APK built alongside it, never
  one that's already installed.

## Rate limiting

`infra/api.ts` sets a default route throttle (`defaultRouteSettings`) of
**50 requests/s steady, 100 burst** — a ceiling against a client retry storm,
well below API Gateway's account-level default. It applies to all clients
together, not per user. Individual accounts are bounded instead by sign-in
(every request apart from the two public catalogs is tied to a Google
account) and, on the free plan, by the daily quota of 30 card reads and 10
reader opens (D107).

## CI builds

`ci.yml`'s main-branch pipeline runs the mobile chain when `apps/mobile`,
`packages/shared`, `pnpm-lock.yaml` or either mobile workflow has changed
since the newest `mobile-v*` tag, and only once `lint`, `typecheck`, `test`,
`schema-check`, `mobile-icon-check` and `mobile-security-scan` have passed:

1. **`mobile-changes`** decides whether to build, and fails the chain if the
   `PRODUCTION_API_URL` repository variable is unset.
2. **`mobile-version-bump`** runs `scripts/bumpMobileVersion.ts` and pushes
   the result to `main` with `[skip ci]`: `versionCode` and `runtimeVersion`
   go up by one on every run, and `version`/`versionName` get a
   conventional-commit semver bump from the commits since the last tag.
3. Then, in parallel:
   - **`mobile-play-release`**
     ([mobile-release.yml](../.github/workflows/mobile-release.yml)) builds
     the `production` profile as an AAB, keeps it as the run artifact
     `techtok-<run#>.aab`, and publishes it to `internal` and `alpha` in a
     single Play edit (Play accepts each `versionCode` only once).
     `internal` releases reach their testers immediately; every `alpha`
     release goes through Play review.
   - **`mobile-build`**
     ([mobile-build.yml](../.github/workflows/mobile-build.yml)) builds the
     `preview` profile as an APK, publishes the matching `preview` EAS
     Update, attaches the APK to a GitHub Release `android-build-<run#>` with
     release notes from the `feat:`/`fix:` commits, and tags
     `mobile-v<version>`. The release isn't a pre-release, so
     `releases/latest` always resolves to the newest one; `release-cleanup`
     then keeps only the three newest `android-build-*` releases and
     `mobile-v*` tags.

Both builds run `eas build --local` on the GitHub runner (JDK 17 plus the
runner's Android SDK), so they spend no EAS cloud-build credit. Both bake in
`EXPO_PUBLIC_API_URL` from `PRODUCTION_API_URL` and
`EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` from the `GOOGLE_OAUTH_WEB_CLIENT_ID`
secret, and fetch their profile's signing keystore from EAS with
`EXPO_TOKEN`.

**On demand:** GitHub → Actions → **Mobile build** or **Mobile release (Play
Store)** → **Run workflow**, passing the production API URL as `api_url`. A
manual **Mobile build** bumps and pushes the version itself. A manual
**Mobile release** bumps nothing: it builds `main`'s current `versionCode`,
which Play rejects once an upload has used it — so it's for retrying a failed
upload, not for shipping a new build.

### One-time setup

All of this is in place; it's listed for re-creating it.

- **`EXPO_TOKEN`** repository secret: an access token
  (<https://expo.dev/settings/access-tokens>) for the free Expo account that
  owns the EAS project. `app.json` already links that project (`owner`,
  `extra.eas.projectId`, `updates.url`), so `eas init` isn't needed.
- **EAS-managed keystores** for the `preview` and `production` profiles,
  created with `npx eas-cli credentials --platform android` run **from
  `apps/mobile/`** — from the repo root, `eas-cli` doesn't find the project
  and offers to create an unrelated new one. Both profiles keep the default
  `credentialsSource: remote`, so no keystore lives in GitHub. The
  `production` keystore is the permanent Play **upload key**.
- **`PlayServiceAccountKey`** repository secret: a Google Cloud service
  account key with Play Developer API access. Without it the publish step
  skips and the AAB stays a downloadable artifact.
- **`PRODUCTION_API_URL`** repository variable: the production API Gateway
  base URL. Read it from the latest **Deploy production** run, or look it up:

  ```
  aws apigatewayv2 get-apis --region eu-central-1 --query "Items[?starts_with(Name, 'techtok-production-')].ApiEndpoint" --output text
  ```

The remaining secrets these workflows read (`GOOGLE_OAUTH_WEB_CLIENT_ID`, the
optional `SENTRY_AUTH_TOKEN`) are in the README's
[secrets table](../README.md#required-repository-secrets).

iOS isn't wired up: the app is tested on Android only (D12), and an iOS build
would need a macOS runner plus Apple signing assets.

## Google Play Console

- The app is `com.tormozz48dev.techtok`; an `applicationId` can never change
  after the first upload.
- **Play App Signing** is on: Google re-signs every upload with its
  app-signing key, so the upload key never reaches devices. Google Sign-In in
  Play installs therefore needs the **app-signing key's** SHA-1 on the
  Android OAuth client — not the upload key's (D68). Play Console lists both
  certificates with the app-signing settings.
- Tracks in use: `internal` (review-free, the maintainer's device) and
  `alpha` (the [closed test](#installing-as-a-tester-google-play-closed-test)).
  Production needs the 12-testers-for-14-days requirement met first.
- The listing needs a store listing, content rating, target audience, **Data
  safety** (the answer key, traced field-by-field to the code, is
  [docs/DATA_SAFETY.md](DATA_SAFETY.md)), a **privacy policy URL** —
  `https://techtokapp.eu/privacy/`, served from
  `apps/site/src/pages/privacy.astro` — and a web account-deletion URL
  reachable without installing the app:
  `https://techtokapp.eu/delete-account/`.
- To upload by hand (a local build, or a CI artifact whose automatic upload
  failed): open the track in Play Console, create a new release, and upload
  the `.aab`. Its `versionCode` must be higher than any Play has accepted.

### Store listing assets

The **feature graphic** Play requires for the listing (1024×500, PNG/JPEG, max
15 MB) is committed at [apps/mobile/store/play/](../apps/mobile/store/play/) —
one per listing language (`en`/`ru`/`uk`/`pl`), each alongside the SVG it was
rendered from. Upload the matching language's PNG under **Main store listing →
Graphics** for each locale you publish.

Phone screenshots for the listing (Play wants at least two) aren't committed;
capture them on a device.

## Building & publishing without EAS (local Gradle → Google Play)

The repo keeps a committed native `android/` project (bare workflow, DESIGN §2
D18) so you *can* build and publish entirely with the standard Android
toolchain — no EAS, no Expo cloud build, no GitHub Actions. This is an
offline fallback; **it is not the path this maintainer uses** — see
[CI builds](#ci-builds) above for the one actually in use.

### Prerequisites (one time, maintainer machine)

- **JDK 17** and the **Android SDK** (Android Studio, or `sdkmanager`); set
  `ANDROID_HOME` / `ANDROID_SDK_ROOT`.
- **The Play upload key.** Play accepts only uploads signed with the upload
  key it has on record — the EAS-managed `production` keystore CI signs with.
  Download it with `npx eas-cli credentials --platform android` (from
  `apps/mobile/`, `production` profile) and keep the file **outside** the
  repo. Then copy `apps/mobile/android/keystore.properties.example` →
  `apps/mobile/android/keystore.properties` (gitignored) and fill in the
  absolute `storeFile` path, the key alias and the passwords.
  `android/app/build.gradle` reads this for the `release` signing config and
  falls back to the debug key when absent. A newly generated keystore (the
  `keytool` command in the example file) is accepted only after an
  upload-key reset in Play Console.

### Changing the native project

`android/` is committed and maintained by hand. **Don't run
`pnpm prebuild:android` to pick up an `app.json` plugin or native-module
change** (D107): it regenerates `android/` from scratch, reverting every
customization committed there — the Sentry Gradle plugin, the
`keystore.properties` release signing config, the `android.debuggableVariants`
hook the Maestro E2E build needs, the Gradle tuning — and resets
`versionCode` to 1, which makes every later Play upload fail. Make the native
edits by hand and keep the `app.json` plugin entry as the record of them.

### Building the release artifact

The release JS bundle embeds `EXPO_PUBLIC_API_URL` and
`EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` from `apps/mobile/.env` (or the shell env).
Point the first at the **production** API (see the lookup under
[One-time setup](#one-time-setup)) and set the second to the Google OAuth web
client ID, or sign-in fails in the build.

```
cd apps/mobile && pnpm build:android
```

- Both `build:android` and `build:android:apk` run the `check-api-url` guard
  (`scripts/checkProductionApiUrl.ts`) first, which refuses an unset URL, the
  placeholder `https://your-api-id.execute-api.eu-central-1.amazonaws.com`,
  and anything not shaped like an `eu-central-1` API Gateway URL. Shape
  can't tell `dev` from `production`, so check the URL it prints.
- Output: `apps/mobile/android/app/build/outputs/bundle/release/app-release.aab`
  (an **AAB**, which is what Play requires for new apps).
- `pnpm build:android:apk` instead produces a sideloadable APK for quick device
  testing (not for Play).
- **Bump `versionCode` by hand before uploading.** CI uploads every AAB it
  builds, so the `versionCode` on `main` (`android/app/build.gradle`) has
  normally been used already, and Play rejects a reused one. Commit the bump
  so CI's next increment continues past it.

### Caveats specific to this app

- **OTA updates** (`expo-updates`; `app.json` → `updates.url`) point at EAS
  Update. A non-EAS store build never receives OTA updates — ship changes as
  new store builds.
- **No push notifications.** The app has no push integration, so there's
  nothing to configure. Adding push later would need its own FCM setup for a
  non-EAS build (an FCM sender and `google-services.json`).
