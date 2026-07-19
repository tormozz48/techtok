# TechTok

TikTok-style swipe feed for tech & science news: Expo/React Native Android app + AWS backend (SST v4, Ion architecture) that ingests RSS, condenses articles into cards with Claude, and tracks per-user read state and topic preferences.

The two documents that govern this repo:

- [docs/DESIGN.md](docs/DESIGN.md) — architecture, API, data model. §2 is the **decision log** (D1–D15), §12 the deferred defaults.
- [docs/IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md) — 7 phases, each gated by acceptance criteria.

Never re-decide something already in the decision log. If a decision must change, update the log entry with the reason (`/log-decision`), then implement.

## Status

**Phase 0 (walking skeleton) complete and fully verified.** `packages/shared`, `packages/core`, `packages/functions`, `apps/mobile`, and the SST `infra/` are all written; lint + typecheck + test are green (57 tests). Deployed to the `andrey` dev stage on real AWS: DynamoDB table, EventBridge cron, and both API routes are live, the ingest cron has run on its own schedule and populated real posts from all 3 sources, and the Android app has been confirmed on a physical device via Expo Go — cards render with images and swipe correctly. All Phase 0 acceptance criteria are met.

**Phase 1 (users & read state) complete and fully verified.** `Users`/`UserActivity` DynamoDB tables, device-identity middleware (`X-Device-Id`), `POST /v1/reads`, `GET/PUT /v1/me(/topics)`, `GET /v1/history`, and the topic-filtered/read-excluding feed algorithm (DESIGN §5.2) are all written and tested (91 tests total). Mobile adds `zustand` + `@react-native-async-storage/async-storage` for device id, topic-prefs cache, and a persisted read-queue (1.5s page-settle timer, 5s/background flush) wired into `FeedPager`/`Card`, plus new `/settings` and `/history` screens. (Initially built on `react-native-mmkv`, which crashed on launch — Expo Go only supports its bundled native-module set and MMKV v4's Nitro-modules require a custom dev client; swapped to AsyncStorage, which Expo Go does bundle. See the `expo-go-native-module-constraint` memory before adding any other native dep.) Lint + typecheck + test all green, deployed, and confirmed on a physical device via Expo Go: swiped cards never reappear across restarts, two devices have independent read state and topic prefs, deselecting a topic filters the feed, and history paginates newest-first. All Phase 1 acceptance criteria are met. Next: Phase 2 (real pipeline). **Update this section whenever a phase lands.**

## Commands (canonical root scripts)

```
pnpm install
pnpm lint        # Biome — this repo has NO ESLint/Prettier (D7)
pnpm typecheck   # tsc --noEmit across workspaces + sst.config.ts/infra (the latter only after a first `pnpm dev`)
pnpm test        # vitest (shared/core/functions) + jest (mobile)
pnpm dev         # sst dev — live Lambda on your personal stage
pnpm --filter mobile start   # Expo dev server
```

Definition of done for any change: lint + typecheck + tests green, then exercised on the dev stage / a device. Verify by running the commands, not by reading the code.

## Layout (planned)

- `packages/shared` — zod v4 contracts + topic taxonomy; imported by server **and** app; no runtime deps beyond zod
- `packages/core` — all business logic (RSS mapping, URL canonicalization, feed merge, DynamoDB repos, LLM client)
- `packages/functions` — thin Lambda handlers only: parse input → call core → serialize
- `apps/mobile` — Expo app (expo-router)
- `infra/` — SST components imported by `sst.config.ts`

## Hard rules

- TypeScript strict, Node 22, pnpm workspaces — never npm/yarn commands.
- Handlers stay thin: if logic can't be unit-tested without AWS, it belongs in `core`, not `functions`.
- Every API request/response shape is a zod schema in `packages/shared`; server parses inputs, app parses responses.
- Tests never call live AWS or Bedrock: `aws-sdk-client-mock` + recorded LLM golden fixtures. CI must run with no AWS credentials.
- Pipeline failure split (DESIGN §7.2): content-level failures **degrade** (excerpt card, feed never starves); infra-level failures **throw** → SQS retry → DLQ → alarm. Never invert this.
- LLM calls go only through the capped transform path (daily counter + reserved concurrency 2). No ad-hoc Bedrock calls anywhere else.
- Feed access follows the key design in DESIGN §6 (primaryTopic GSI, read-markers via BatchGet). No table scans or filter-expression shortcuts on `Posts`.
- Keep React Native code cross-platform (D12): no Android-only APIs without a `Platform` guard.
- Conventional commits: `feat:` / `fix:` / `docs:` / `chore:` / `test:` / `refactor:`.

## AWS

- Region `eu-central-1`. Stages: personal dev stage (`sst dev`) and `production` (deployed by CI only — don't `sst deploy --stage production` from a laptop).
- Never run `sst remove` (denied in settings.json); it destroys deployed stacks.
- Budget ceiling is **$10/mo** (D11). Anything cost-bearing — schedule rates, LLM volume/caps, log retention, new always-on resources — gets checked against DESIGN §10 first.

## Claude config in this repo

- `.claude/settings.json` — permission allowlist for the common loop + a PostToolUse hook that auto-formats edited files with Biome (no-ops until Biome is installed in Phase 0).
- `/check` — run all quality gates and fix until green
- `/phase` — report progress against the implementation plan, propose next increment
- `/log-decision` — append a decision to the DESIGN.md decision log
