# TechTok

TikTok-style swipe feed for tech & science news. See [CLAUDE.md](CLAUDE.md) for the full contract, [docs/DESIGN.md](docs/DESIGN.md) for architecture, and [docs/IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md) for the phased build-out.

## Prerequisites

- Node 22 (`nvm use`)
- pnpm (`corepack enable` picks up the pinned version automatically)
- An AWS account with credentials configured locally, for `sst dev`/`sst deploy`
- For local Android release builds only: JDK 17 + the Android SDK

## Setup

```
pnpm install
```

## Backend (AWS, via SST)

```
pnpm dev              # sst dev --stage dev — live Lambda reload on the personal "dev" stage
pnpm deploy:dev       # sst deploy --stage dev — one-off deploy of the dev stage
```

The first run bootstraps your AWS account and prints the API's URL (`Api: https://....execute-api.eu-central-1.amazonaws.com`) — copy it for the mobile app's `.env`, below. Leave `sst dev` running; it keeps your stage in sync with local changes. **Production is deployed by CI only** (see [Deployment](#deployment-cicd)) — never `sst deploy --stage production` from a laptop.

## Mobile app (Expo)

```
cd apps/mobile
cp .env.example .env    # then set EXPO_PUBLIC_API_URL to the sst dev API URL above
cd ../..
pnpm --filter mobile start
```

Scan the QR code with Expo Go, or press `a` for an Android emulator.

## Mobile builds (Android)

The app ships a committed, bare `android/` project (Expo prebuild output — DESIGN §2 D18), so release artifacts build with the standard Gradle toolchain. Needs **JDK 17** + the **Android SDK** locally.

```
pnpm --filter mobile build:android       # release AAB -> android/app/build/outputs/bundle/release/
pnpm --filter mobile build:android:apk   # release APK -> android/app/build/outputs/apk/release/
pnpm --filter mobile prebuild:android    # regenerate android/ after app.json / plugin / SDK changes
```

Release signing reads a gitignored `apps/mobile/android/keystore.properties` (falls back to the debug key when absent). Keystore creation, Google Play publishing, and the bare-workflow caveats are documented in [docs/DISTRIBUTION.md](docs/DISTRIBUTION.md).

## Quality gates

```
pnpm lint        # Biome
pnpm typecheck   # tsc --noEmit, every package + sst.config.ts (the latter only after a first `pnpm dev`)
pnpm test        # vitest (shared/core/functions) + jest (mobile)
```

All three must be green before considering a change done.

## Deployment (CI/CD)

Two GitHub Actions workflows run on push to `main`:

- **`CI`** ([.github/workflows/ci.yml](.github/workflows/ci.yml)) — runs the quality gates, then deploys the backend with `sst deploy --stage production` (AWS access via OIDC, no long-lived keys).
- **`Mobile build`** ([.github/workflows/mobile-build.yml](.github/workflows/mobile-build.yml)) — builds an Android APK with `eas build --local` (runs on the GitHub runner, so it does **not** consume EAS free-tier cloud-build credits) and attaches it to a GitHub **Release** for sideloading. Also runnable on demand via **Actions → Mobile build → Run workflow**.

The mobile workflow needs an `EXPO_TOKEN` repo secret plus a one-time `eas credentials` setup — see [docs/DISTRIBUTION.md](docs/DISTRIBUTION.md#automated-ci-builds-recommended).
