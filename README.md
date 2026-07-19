# TechTok

TikTok-style swipe feed for tech & science news. See [CLAUDE.md](CLAUDE.md) for the full contract, [docs/DESIGN.md](docs/DESIGN.md) for architecture, and [docs/IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md) for the phased build-out.

## Prerequisites

- Node 22 (`nvm use`)
- pnpm (`corepack enable` picks up the pinned version automatically)
- An AWS account with credentials configured locally, for `sst dev`/`sst deploy`

## Setup

```
pnpm install
```

## Backend (AWS, via SST)

```
pnpm dev              # sst dev — deploys to your personal stage, live Lambda reload
```

The first run bootstraps your AWS account and prints the API's URL (`Api: https://....execute-api.eu-central-1.amazonaws.com`) — copy it for the mobile app's `.env`, below. Leave `sst dev` running; it keeps your stage in sync with local changes.

## Mobile app (Expo)

```
cd apps/mobile
cp .env.example .env    # then set EXPO_PUBLIC_API_URL to the sst dev API URL above
cd ../..
pnpm --filter mobile start
```

Scan the QR code with Expo Go, or press `a` for an Android emulator.

## Quality gates

```
pnpm lint        # Biome
pnpm typecheck   # tsc --noEmit, every package + sst.config.ts (the latter only after a first `pnpm dev`)
pnpm test        # vitest (shared/core/functions) + jest (mobile)
```

All three must be green before considering a change done.
