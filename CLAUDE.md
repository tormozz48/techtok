# TechTok

TikTok-style swipe feed for tech & science news: Expo/React Native Android app + AWS backend (SST v4, Ion architecture) that ingests RSS, condenses articles into cards with Claude, and tracks per-user read state and topic preferences.

The two documents that govern this repo:

- [docs/DESIGN.md](docs/DESIGN.md) — architecture, API, data model. §2 is the **decision log** (D1–D15), §12 the deferred defaults.
- [docs/IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md) — 7 phases, each gated by acceptance criteria.

Never re-decide something already in the decision log. If a decision must change, update the log entry with the reason (`/log-decision`), then implement.

## Status

**Phase 0 (walking skeleton) complete and fully verified.** `packages/shared`, `packages/core`, `packages/functions`, `apps/mobile`, and the SST `infra/` are all written; lint + typecheck + test are green (57 tests). Deployed to the `andrey` dev stage on real AWS: DynamoDB table, EventBridge cron, and both API routes are live, the ingest cron has run on its own schedule and populated real posts from all 3 sources, and the Android app has been confirmed on a physical device via Expo Go — cards render with images and swipe correctly. All Phase 0 acceptance criteria are met.

**Phase 1 (users & read state) complete and fully verified.** `Users`/`UserActivity` DynamoDB tables, device-identity middleware (`X-Device-Id`), `POST /v1/reads`, `GET/PUT /v1/me(/topics)`, `GET /v1/history`, and the topic-filtered/read-excluding feed algorithm (DESIGN §5.2) are all written and tested (91 tests total). Mobile adds `zustand` + `@react-native-async-storage/async-storage` for device id, topic-prefs cache, and a persisted read-queue (1.5s page-settle timer, 5s/background flush) wired into `FeedPager`/`Card`, plus new `/settings` and `/history` screens. (Initially built on `react-native-mmkv`, which crashed on launch — Expo Go only supports its bundled native-module set and MMKV v4's Nitro-modules require a custom dev client; swapped to AsyncStorage, which Expo Go does bundle. See the `expo-go-native-module-constraint` memory before adding any other native dep.) Lint + typecheck + test all green, deployed, and confirmed on a physical device via Expo Go: swiped cards never reappear across restarts, two devices have independent read state and topic prefs, deselecting a topic filters the feed, and history paginates newest-first. All Phase 1 acceptance criteria are met.

**Phase 2 (real pipeline) complete and fully verified, including production CI/CD.** `Sources` DynamoDB table seeded with the full ~11-feed preset list (all 3 DESIGN §2 presets); Step Functions `IngestPipeline` (`LoadSources` → `Map(FetchSource, maxConcurrency 4)` → `Summarize`) on an EventBridge Scheduler `rate(30 min)` trigger; SQS `TransformQueue` + DLQ (redrive after 3 receives, `partialResponses` per-message retry); a transform consumer that fetches the article page (10s timeout, 2MB cap, robots.txt-respecting, `TechTokBot` UA), archives raw HTML to S3 (90-day lifecycle), and derives an improved excerpt via `@extractus/article-extractor` (no LLM yet — phase 3); CloudWatch alarms (DLQ depth, SFN execution failures, API 5xx) + a $10 AWS Budget, both wired to one SNS topic; a GitHub Actions `deploy` job (OIDC → AWS, no long-lived keys) that runs `sst deploy --stage production` on merges to `main`. 96 vitest + 14 mobile-jest tests green. Deployed to the `andrey` dev stage and verified live end-to-end: a full pipeline execution fanned out over all 11 sources and succeeded; two sources hit genuine Lambda timeouts and were correctly isolated by the Map's per-item `.catch()` without failing the run; a deliberately-broken feed URL confirmed the primary failure path — `failCount`/`lastStatus` recorded on the `Sources` row, run still succeeded; dedup holds structurally (`postId` is the table's primary key) and was confirmed across repeated executions; a real bug (DynamoDB rejects `status`/`transform` as unaliased reserved words in `UpdateExpression`, silently failing every transform and piling the entire backlog into the DLQ) was caught live, fixed, and confirmed by watching `DlqDepthAlarm` transition `ALARM → OK` after redriving the backlog; a second bug (the Map's per-item `.catch()` replaces state input with `{Error, Cause}` by default, crashing `Summarize` on the first genuine infra failure) was also caught live and fixed. CI/CD: IAM OIDC provider/deploy-role bootstrapped in AWS, `AWS_DEPLOY_ROLE_ARN` GitHub secret added — the trust policy initially used the plain `owner/repo` subject format and needed correcting to GitHub's newer immutable-ID format (`repo:OWNER@ID/REPO@ID:ref:...`, confirmed via CloudTrail `AccessDenied` events) before OIDC auth succeeded. The subsequent `production` `sst deploy` then hit a real AWS account constraint — reserved concurrency 2 on the Transform Lambda (DESIGN §7.2) can't be set because this account's Lambda concurrent-execution quota is stuck at 10, below every function's mandatory 10-unreserved minimum; logged as D16, reserved concurrency is dropped for now on both stages until the quota is raised. With that fix, both the `quality` and `deploy` CI jobs are green and `production` is fully stood up: `IngestPipeline` state machine, all API routes, and the transform pipeline all live under the `techtok-production-*` stack. All Phase 2 acceptance criteria are met.

**Phase 3 (LLM transform) complete.** `core/llm` (Bedrock Converse provider, zod-validated output, one repair-retry, degrade-to-excerpt on any failure), a `Counters` table + atomic daily-cap repo (`eu.anthropic.claude-haiku-4-5-20251001-v1:0`, confirmed the correct ACTIVE EU inference profile ID), `transformArticle` wired to call the LLM under cap, Card DTO/UI show `whyItMatters` + a debug transform badge, and a one-shot backfill script for existing excerpt posts. All Phase 3 acceptance criteria are met.

**Phase 4 (feed quality & polish) — full menu implemented and verified live on the `andrey` dev stage.** All 7 menu items landed: (1) topic onboarding screen on first launch; (2) card design pass — typography/radius/scheme-independent overlay tokens, skeleton loading states, haptic tick on page-settle, optional blurhash plumbing (gated on a future ingest-side field); (3) ranking experiment — `buildFeed` now scores unread candidates by recency-decay(6h half-life) × `Sources.weight` × topic-round-robin interleave, with the publishedAt-sorted candidate list kept separate from the ranked display list so the `nextBefore` pagination cursor never breaks; (4) bookmarks — `UserActivity`'s reserved `bm#` sort-key space plus a dedicated `byBookmarkedAt` GSI, `POST/DELETE/GET /v1/bookmarks`, `isBookmarked` on feed cards, a bookmark icon + `/saved` screen + RN `Share`-based share sheet; (5) image mirroring — a new `Images` S3 bucket + `sst.aws.Router` CloudFront distribution, transform-time mirror step that degrades to the original hotlinked url on any failure; (6) offline prefetch — wifi-gated `Image.prefetch` of the next 3 cards (via `expo-network`'s push-based listener) plus a `@tanstack/query-async-storage-persister`-backed feed cache, closing a real gap where DESIGN.md claimed this already existed; (7) cross-source duplicate collapse (experiment) — token-set-Jaccard title matching within a 48h window, mark-and-filter (never deletes), behind a one-line `DEDUP_ENABLED` toggle. 171 vitest + 26 mobile-jest tests green; every backend piece was exercised live end-to-end (bookmarks CRUD, a real mirrored image loading via CloudFront, a forced `FetchSource` invocation, hand-toggling `duplicateOf` against `GET /v1/feed`). Mobile-side UI (onboarding flow, card redesign, bookmark/share icons, `/saved` screen) still wants a final pass on a physical device via Expo Go. Phase 4's actual exit bar per the implementation plan is subjective — "the feed feels good in daily personal use for a week" — so treat this as feature-complete, not phase-closed, until that week has passed. **Update this section whenever a phase lands.**

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
- LLM calls go only through the capped transform path (daily counter + reserved concurrency 2). No ad-hoc Bedrock calls anywhere else. (Reserved concurrency is currently unset pending an AWS account quota fix — see DESIGN §2 D16 — re-add before phase 3 wires in real Bedrock calls.)
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
