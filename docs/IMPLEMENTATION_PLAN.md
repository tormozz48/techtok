# TechTok — Implementation Plan

Companion to [DESIGN.md](DESIGN.md). Seven phases; every phase ends with something you can demo on a phone. Effort estimates are focused solo days — spread over evenings, multiply accordingly.

**Principles**

- Walking skeleton first: the thinnest end-to-end slice (real feed → real AWS → real device) before any sophistication.
- Always deployable: `main` is green (Biome + typecheck + tests) and deployed.
- Each phase has explicit acceptance criteria — the phase is done when they pass on a device, not when the code compiles.
- Definition of done per change: lint + typecheck + tests green locally, exercised on the dev stage.

**Phase map**

| Phase | Theme | Key AWS pieces added | Effort |
|---|---|---|---|
| 0 | Walking skeleton | Cron Lambda, DynamoDB, API GW, SST | 1–2 d |
| 1 | Users & read state | Users/UserActivity tables | 2 d |
| 2 | Real pipeline | Step Functions, SQS+DLQ, S3, Sources table, CI deploy | 2–3 d |
| 3 | LLM transform | Bedrock, cost caps | 2 d |
| 4 | Feed quality & polish | CloudFront (images), ranking | 3 d+ |
| 5 | Friends rollout | EAS distribution, (maybe) push | 2 d |
| 6 | Hardening | Sentry, Maestro, budget review | 2 d |

---

## Phase 0 — Walking skeleton

**Goal:** swipe ~20 real cards from 3 real feeds on a physical Android device, served by real AWS. No users, no LLM, no SFN/SQS (per D14).

**Tasks**

1. **Repo scaffold:** pnpm workspaces (`pnpm-workspace.yaml`, root scripts), `tsconfig.base.json` (strict), `biome.json`, `.nvmrc`/`engines` (Node 22), README quickstart.
2. **SST init:** `sst.config.ts` + `infra/` split; stages `dev`(personal)/`production`; region `eu-central-1`.
3. **`packages/shared`:** topic taxonomy, `Card`/`FeedResponse` zod schemas.
4. **`packages/core`:** URL canonicalization (strip tracking params) + hash → `postId`; RSS entry → post mapping (title, excerpt ≤ 280, image fallback chain, publishedAt); Posts repo (conditional put, byTopic/byTime queries). Unit tests with fixture XML from the 3 real feeds.
5. **Ingest v0:** `Cron(rate 1 hour)` → Lambda: 3 hardcoded feeds (HN, The Verge, ScienceDaily) → excerpt cards (`status=ready`, `transform=excerpt`, `ttl` 90 d). Powertools logging from the start.
6. **API v0:** `GET /v1/feed?limit&before` (no auth, no read-filtering) + `GET /v1/topics`.
7. **Expo app:** create in `apps/mobile` (dev client build via EAS or local `expo run:android`); vertical `react-native-pager-view` feed over `useInfiniteQuery`; Card component (image + scrim + title + excerpt + source + time-ago); link-out via `expo-web-browser`; dark theme tokens.
8. **CI:** GitHub Actions — install → `biome ci` → typecheck → vitest → mobile jest. (No deploy job yet.)

**Acceptance criteria**

- [ ] `pnpm lint && pnpm typecheck && pnpm test` green locally and in CI.
- [ ] `sst deploy --stage dev` from scratch succeeds; cron run populates ≥ 20 posts.
- [ ] On a physical Android phone: cold-open → cards render with images → swipe through 20 → tap opens source article.
- [ ] A teammate could reproduce from README alone.

**Out of scope:** read status, preferences, SFN/SQS/S3, LLM, history.

---

## Phase 1 — Users & read state

**Goal:** the server knows who you are, what you've read, and what you care about. Two phones see independent feeds.

**Tasks**

1. Device identity: app generates UUID → SecureStore/MMKV; `X-Device-Id` on every call; API middleware upserts `Users` row.
2. `UserActivity` table + `POST /v1/reads` (batch, idempotent) + read-exclusion in the feed query (BatchGet membership check).
3. App read-queue: 1.5 s page-settle timer → queue (MMKV-persisted) → flush every 5 s + on background.
4. Topics: `PUT /v1/me/topics`, `GET /v1/me`; settings modal with topic multi-select; feed respects selection (per-topic GSI queries + merge, per DESIGN §5.2).
5. History: snapshot written with each read-marker; `GET /v1/history` (byReadAt GSI, cursor pagination); history screen.
6. Ingest assigns `primaryTopic` from source default mapping (until the LLM classifier exists).

**Acceptance criteria**

- [ ] Swiped cards never reappear in the feed (verified across app restarts).
- [ ] Two devices have independent read state and topic prefs.
- [ ] Deselecting a topic removes its cards from the next feed page.
- [ ] History lists read cards newest-first and paginates.

---

## Phase 2 — Real pipeline (Step Functions + SQS + S3)

**Goal:** the ingestion described in DESIGN §7.2 — managed source list, fan-out, isolation, retries, DLQ — plus automated prod deploys. (LLM still not wired; transform produces excerpt cards + S3 archive.)

**Tasks**

1. `Sources` table + seed script for the ~11 feeds from all three presets (verify each feed URL live).
2. Step Function `IngestPipeline`: LoadSources → Map(FetchSource, concurrency 4, per-item Catch → `failCount`/`lastStatus`) → Summarize (EMF metrics). EventBridge `rate(30 min)`. Conditional GET via stored `etag`/`lastModified`.
3. SQS `TransformQueue` + DLQ (maxReceive 3); FetchSource enqueues only newly-created postIds.
4. Transform Lambda v1 (no LLM yet): fetch page (timeout/size caps, `TechTokBot` UA, robots.txt) → extract text → S3 `raw/<postId>.html` → improve excerpt card. Reserved concurrency 2 is the intended valve (the valve exists before the expensive thing does), but currently unset — this AWS account's Lambda concurrent-execution quota is stuck at 10 (see DESIGN §2 D16); re-add once the account quota is raised.
5. S3 bucket + 90-day lifecycle; DDB TTL verified end-to-end.
6. Alarms: DLQ depth > 0, SFN execution failed, API 5xx; AWS Budget $10 with email.
7. CI deploy job: `sst deploy --stage production` on main via GitHub OIDC role; app `preview` profile points at production API.
8. Delete the phase-0 cron ingest.

**Acceptance criteria**

- [ ] All ~11 sources flow through SFN on schedule; one deliberately-broken feed URL shows an isolated Map-item failure, `failCount` increments, run succeeds.
- [ ] No duplicate posts after 24 h of scheduled runs (conditional-put dedup holds).
- [ ] A poison message lands in the DLQ and fires the alarm.
- [ ] Merging to main deploys production with no manual steps.

---

## Phase 3 — LLM transform

**Goal:** cards become what the product promised — hook title, tight summary, "why it matters", real topic classification. Costs provably capped.

**Tasks**

1. Bedrock model access enabled (one-time console step); confirm `eu.anthropic.claude-haiku-4-5-*` inference profile ID.
2. `core/llm`: provider-agnostic interface → Bedrock Converse impl; prompt in repo; zod output schema (DESIGN §7.4); one repair-retry → excerpt fallback.
3. Golden-fixture tests: ~10 recorded article→card pairs; CI never calls Bedrock.
4. Daily-cap counter (atomic increment, default 120/day) — over cap ⇒ `transform=skipped` excerpt card.
5. Topic classification from LLM replaces source-default mapping (validated against the taxonomy enum, fallback to source default).
6. Card UI: render `whyItMatters` line + `transform` badge in a debug view.
7. One-shot backfill script: re-enqueue recent `transform=excerpt` posts through the LLM path.

**Acceptance criteria**

- [ ] Fresh articles show LLM cards within one pipeline cycle; malformed LLM output degrades to excerpt, never a stuck post.
- [ ] Setting the cap to 5 and running a cycle yields exactly 5 `transform=llm` posts, rest `skipped` — feed stays full.
- [ ] Week-one Bedrock spend extrapolates to ≤ $10/mo (check Cost Explorer).
- [ ] Subjective bar: you'd rather read the card than the source's RSS blurb, 8/10 times.

---

## Phase 4 — Feed quality & UX polish

**Goal:** from "works" to "friends keep it installed". Scope is a menu — pull items as they earn priority.

**Menu**

- Image mirroring: transform stage copies article image → S3 + CloudFront (kills hotlink rot; ~$1/mo).
- Ranking experiment: recency decay × source `weight` × topic diversity (interleave topics instead of pure newest-first).
- Bookmarks (`bm#` items) + saved screen; share sheet polish.
- Offline: explicit prefetch of next N cards + images on wifi.
- Card design pass: typography scale, blurhash placeholders, skeleton states, haptics on page-settle.
- Topic onboarding screen on first launch.
- Cross-source duplicate-story collapse (canonical URL + title similarity) — experiment.

**Acceptance criteria:** defined per pulled item; phase exits when the feed feels good in daily personal use for a week.

---

## Phase 5 — Friends rollout

**Goal:** other humans on their own phones, without you touching their device.

**Tasks**

1. EAS internal distribution: `preview` APK build against production API; install-link doc for friends.
2. Rate limiting sanity: API GW throttling defaults reviewed; per-device abuse is a non-goal (friends-scale trust).
3. Feedback loop: in-app "send feedback" (mailto link is fine).
4. Optional, only if wanted: daily digest push via `expo-notifications` (server: EventBridge cron → top-N unread per user → Expo push API).
5. Watch CloudWatch dashboards for a week; fix what real usage breaks.

**Acceptance criteria**

- [ ] ≥ 2 friends installed from the link, no hands-on help.
- [ ] Zero shared-state bugs (their reads/topics never bleed into yours).
- [ ] Costs still ≤ budget with real usage.

---

## Phase 6 — Hardening

**Goal:** boring reliability; the project can idle unattended.

**Tasks**

1. Sentry (mobile + Lambda, free tier) — crashes and API error rates visible.
2. Maestro E2E: one smoke flow (launch → swipe 3 → open article → mark topics) run on-demand/nightly, not per-PR.
3. Renovate for dependency updates (grouped, weekly).
4. Ops runbook in `docs/`: stuck DLQ, broken source, Bedrock outage, cost spike — diagnosis + fix per case.
5. Cost & retention review: log retention, S3 lifecycle verification, DDB table sizes.
6. iOS checkbox (D12): `expo run:ios` compiles and the pager renders — no further iOS investment.

**Acceptance criteria**

- [ ] A deliberately-broken source, a DLQ message, and a Bedrock throttle are all diagnosable from dashboards + runbook alone.
- [ ] Two weeks untouched: no alarm, no cost drift, feed still fresh.

---

## Sequencing notes & standing risks

- Phases 0→3 are strictly ordered; 4–6 can interleave.
- The riskiest unknowns are front-loaded deliberately: DDB key design proves itself in phase 1 (read-exclusion at query time), pipeline semantics in phase 2 (dedup under concurrency), LLM economics in phase 3 (cap mechanics). Each phase's acceptance criteria exist to force that proof.
- Standing rule from DESIGN §2: content-level failures degrade (excerpt cards), infra-level failures alarm (DLQ). Any new pipeline code follows the same split.
- After phase 3, re-read DESIGN §12 (deferred defaults) and promote/kill items deliberately rather than by drift.
