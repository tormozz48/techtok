# TechTok — Implementation Plan

Companion to [DESIGN.md](DESIGN.md). Sixteen phases (0–6 original build-out, 7–10 the 2026-07-22 extension, D20–D25, 11–12 the 2026-07-24 extension, D26–D30, 13 the 2026-07-24 LLM provider swap, D32, 14 the 2026-07-24 CI/CD hardening, D33–D35, 15 the 2026-07-24 eager compact-article generation, D36, 16 the 2026-07-24 visual identity redesign + native-asset sync fix, D37); every phase ends with something you can demo on a phone. Effort estimates are focused solo days — spread over evenings, multiply accordingly.

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
| 7 | Images & app shell | image-chain fix + backfill, stub, bottom bar, splash/loading | 2 d |
| 8 | Localization | TranslateQueue, i18n map, language pref, chrome i18n, quotas | 2–3 d |
| 9 | Compact reader | content Lambda, figure mirroring, reader screen, kill switch | 3 d |
| 10 | Extension polish | digest localization, feedback loop, cost review, cap tuning | 1–2 d |
| 11 | UI component library adoption | React Native Paper (MD3) | 2 d |
| 12 | Eager translation pipeline + cap removal | remove all daily LLM caps, eager TranslateQueue enqueue, job-polling content API, progress bar | 3–4 d |
| 13 | LLM provider swap (OpenRouter) | `sst.Secret` for OpenRouter API key, OpenRouter provider + env-switchable Bedrock fallback | 1 d |
| 14 | CI/CD hardening | Parallel CI jobs, schema-snapshot-diff guardrail, dev-stage E2E workflow, mobile semver automation | 2–3 d |
| 15 | Eager compact-article generation | `ContentQueue` (eager, all 4 languages), per-post figure-mirror dedup, `ContentJobs` table removal, reader API simplification | 2 d |
| 16 | Visual identity redesign ("Orbit") + native-asset sync fix | New icon/splash assets, surgical `expo prebuild` resource sync preserving D18's signing config, real on-device APK verification | 1 d |

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
4. ~~Daily-cap counter (atomic increment, default 120/day) — over cap ⇒ `transform=skipped` excerpt card.~~ **Removed 2026-07-24 (D31, phase 12):** all daily LLM caps were deleted for simplicity; the `transform=skipped` outcome no longer exists.
5. Topic classification from LLM replaces source-default mapping (validated against the taxonomy enum, fallback to source default).
6. Card UI: render `whyItMatters` line + `transform` badge in a debug view.
7. One-shot backfill script: re-enqueue recent `transform=excerpt` posts through the LLM path.

**Acceptance criteria**

- [ ] Fresh articles show LLM cards within one pipeline cycle; malformed LLM output degrades to excerpt, never a stuck post.
- [x] ~~Setting the cap to 5 and running a cycle yields exactly 5 `transform=llm` posts, rest `skipped` — feed stays full.~~ Moot — caps removed (D31, phase 12).
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
3. ~~Feedback loop: in-app "send feedback" (mailto link is fine).~~ **Removed 2026-07-24 (D29):** the standalone Settings "Send feedback" row was removed; the more targeted long-press bad-translation-report mailto (phase 10) is unrelated and stays.
4. ~~Optional, only if wanted: daily digest push via `expo-notifications` (server: EventBridge cron → top-N unread per user → Expo push API).~~ **Retired 2026-07-24 (D29):** built, then fully removed end-to-end (infra, API route, DB field, mobile toggle) at the user's request.
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

## Phase 7 — Images & app shell

**Goal:** the feed *looks* right — real images on ~every card (1% → high coverage), a proper stub for the rest, one bottom action bar instead of scattered circles, and a branded launch sequence. No new LLM spend anywhere in this phase.

**Tasks**

1. **Ingest-side image chain (D24):** rss-parser `customFields` for `media:content`/`media:thumbnail` + declare `content:encoded`; extend `mapEntryToPost`'s chain to `enclosure → media:content → media:thumbnail → <img> in content:encoded → <img> in content → <img> in summary`. Fixture tests per real feed (Ars, TechCrunch, Phys.org XML samples).
2. **Transform-side og:image rung (D24):** when the post has no `imageUrl`, take `article.image` from the existing `@extractus` result → feed it through the existing `mirrorImage` step. Known-generic denylist (arXiv logo) in `core`, unit-tested.
3. **Image backfill:** one-shot Lambda (pattern: `seedSources`/`backfillLlm`) — scan posts lacking `imageUrl` but having `s3RawKey`, extract og:image from the S3 archive, mirror, update. No LLM, no live refetches. Run on dev, then production.
4. **Stub component (D24):** deterministic gradient (seeded by `postId`) + topic glyph; renders wherever `imageUrl`/`mirroredImageUrl` are absent. Jest snapshot tests.
5. **Bottom action bar (D25):** solid, layout-reserving (~56 px + safe-area insets); bookmark + share (active card) left, saved/history/settings right; pager height shrinks accordingly; remove the overlay circle buttons.
6. **Launch sequence (D25):** branded `expo-splash-screen` (re-run `expo prebuild` for the committed `android/`, D18) + in-app loading screen (logo + spinner) shown while the first feed page is in flight; skeletons stay for later loads.

**Acceptance criteria**

- [ ] Re-running the production image audit (the per-source scan from 2026-07-22) shows ≥ 80% of non-arXiv posts with an image after backfill; arXiv posts show the stub.
- [ ] A fresh ingest cycle produces imaged posts from at least 6 sources that had 0% before.
- [ ] On a device: imageless cards render the gradient+glyph stub (no blank scrims), all five actions work from the bottom bar, no overlay circles remain, cold start shows branded splash → loading screen → feed.
- [ ] `pnpm lint && pnpm typecheck && pnpm test` green; deployed to dev; APK built for a physical-device check.

### Amendment (2026-07-24, D28) — image quality gate

Phase 7 shipped and was verified live before this was identified: some mirrored images are low-quality because their source is a small RSS thumbnail stretched to fill a full-bleed card.

**Task**

7. **Minimum-dimension quality gate (D28):** in the existing `mirrorImage` step, check the candidate's real pixel dimensions (`image-size`, header-only, no native decode) before mirroring; reject below 600px in either dimension. Extend the og:image rung's trigger from "no `imageUrl` at all" to also fire when an `imageUrl` exists but fails this check; a rejected/absent/denylisted og:image falls through to the existing `ImageStub`. New posts only, no backfill.

**Additional acceptance criterion**

- [ ] A post whose only candidate image is under 600px in either dimension renders the `ImageStub` (or a qualifying og:image, if one exists) instead of the undersized image; `pnpm lint && pnpm typecheck && pnpm test` green; deployed to dev.

---

## Phase 8 — Localization (cards, chrome, quotas)

**Goal:** a friend sets Russian/Ukrainian/Polish once and the whole app — cards, topic chips, buttons — reads in their language, with English never blocking. LLM spend stays demand-shaped (D22).

**Tasks**

1. **Shared contracts:** `Language` enum (en/ru/uk/pl) + per-language topic labels in `packages/shared`; Card DTO gains `servedLang`/`isTranslated`/`compactLangs` (the last shipped empty until phase 9).
2. **User preference:** `Users.language` + `PUT /v1/me/language`; `GET /v1/me` returns it; device-locale default on first sight (middleware), onboarding gains a language step; settings row to change it.
3. **Feed serving (D21):** variant selection in `toCard` (serve `i18n[lang]`, fall back to EN); DESIGN §5.2 steps 6–7.
4. **Translate stage (D22):** `TranslateQueue` + DLQ infra (ESM `maxConcurrency: 2`); feed-path conditional enqueue with `i18nPending` markers; consumer Lambda → self-critique-in-call translation (zod, one repair-retry, golden fixtures per language) → write `i18n[lang]`; content failures clear the marker and stay EN, infra failures throw to DLQ. **Amended 2026-07-24 (D27, phase 12):** the feed-path enqueue and `i18nPending` markers are replaced by an eager enqueue at transform time; the queue/DLQ/consumer infra itself is reused as-is.
5. ~~**Caps & quotas (D22):** `translations#<date>` counter (default 100/day) in the translate consumer; per-source `transforms#<sourceId>#<date>` quota (default 30/day, `Sources.dailyQuota` override) gating only the LLM call in `transformArticle`; check whether Hugging Face has an official-posts-only feed URL and switch `Sources` if so.~~ **Removed 2026-07-24 (D31, phase 12):** both counters and the per-source quota were deleted entirely; the Hugging Face official-feed check stands independent of the quota removal and remains valid.
6. **Chrome i18n (D20):** `expo-localization` + typed string tables (settings/history/saved/onboarding/reader strings); language driven by the same stored preference; localized topic labels rendered from shared.
7. ~~**Digest guard:** digest builder picks the user's language variant when present (full localization polish lands in phase 10).~~ **Moot as of 2026-07-24 (D29):** the digest feature this guarded was built here, then fully retired — see phase 5 task 4 and phase 10 task 1.

**Acceptance criteria**

- [x] ~~Switching to RU on a device: chrome flips immediately; the feed's next refresh serves translated cards for previously-viewed posts (pop-in demonstrated: first EN with badge, translated after the queue drains).~~ Pop-in behavior superseded by D27 (phase 12) — cards are pre-translated eagerly, no pop-in by design.
- [ ] Two devices with different languages have fully independent content languages against the same posts.
- [x] ~~Set the translation cap to 3 and scroll: exactly 3 posts gain `i18n` entries, the rest stay EN and re-enqueue on a later day (verified via `Counters` + post items).~~ Moot — caps removed (D31, phase 12).
- [x] ~~HF (or any source) hits its per-source quota in a live cycle: its overflow posts land as `transform=skipped` excerpt cards while other sources still get LLM cards the same day.~~ Moot — per-source quota removed (D31, phase 12).
- [ ] Verbatim-excerpt posts translate too (Q6/D20) and read acceptably on a device.
- [ ] All gates green; deployed; exercised on a physical device.

---

## Phase 9 — Compact reader

**Goal:** tap a card, read a compact translated version of the article with its figures in-app, then jump to the original if hooked (D23). The rights guardrails exist before the feature does.

**Tasks**

1. **Guardrails first (D23):** `Sources.compactEnabled` (default true, per-source off switch) + `compacts#<date>` cap (default 20/day) — both checked before any generation; document remove-on-request in the ops runbook. **Amended 2026-07-24 (D31, phase 12):** the `compacts#<date>` cap was removed; `compactEnabled` is a rights guardrail, not a cost cap, and stays.
2. **Shared contract:** compact-article block schema (`paragraph | heading | image | list | quote`, image blocks reference the provided figure list by index) in `packages/shared`.
3. **Figure extraction + mirroring:** parse in-body `<figure>`/`<img>` from the archived HTML (≤5, minimum dimensions, dedup against the lead image) → existing `ImageStore` mirror path.
4. **Compact generation core:** single-pass compress-to-language LLM call (~8k-char input, self-critique for non-EN), zod + one repair-retry, golden fixtures; any content failure → typed "no compact" result.
5. **Content Lambda (D23):** `GET /v1/posts/:id/content?lang=` (30 s timeout) — S3 cache check → archive load (one live fetch fallback, robots-respecting) → figures → cap/kill-switch check → LLM → write `content/<postId>/<lang>.json` + append to `Posts.compactLangs` → return blocks. CloudFront route for `content/*` on the existing router.
6. **Reader screen:** `/post/[id]` — block renderer, figure images, attribution header, translated ⇄ original toggle (original generates EN via the same endpoint), prominent "Read original" (in-app browser); loading state for the sync wait; graceful "couldn't prepare — open original?" fallback.
7. **Card rewiring (Q17):** tap → reader when a compact exists or is generatable; straight to the browser otherwise; share keeps the original URL; drill-down marks the post read (existing link-open semantics).

**Acceptance criteria**

- [ ] Tap an uncached post: spinner → readable compact article with ≥1 mirrored in-body figure (on a post that has figures) in ≤ 15 s typical; second open (any device) is instant via CDN.
- [ ] The reader's language toggle produces the EN variant on demand; "Read original" opens the source; share shares the original URL.
- [ ] A post whose page can't be fetched/extracted degrades to the in-app browser with no dead end; flipping `compactEnabled=false` on a source routes its cards straight to the browser.
- [x] ~~Set the compact cap to 2: third tap of the day degrades to the browser; `Counters` confirms.~~ Moot — compact cap removed (D31, phase 12).
- [ ] All gates green; deployed; the full card → reader → original loop demonstrated on a physical device.

---

## Phase 10 — Extension polish & cost truth

**Goal:** the extension earns its keep in daily use and provably stays inside the budget posture (D22).

**Tasks**

1. ~~Digest localization end-to-end: push text uses the recipient's language (generate/fetch translations for the top-5 the same on-demand way, under the translation cap).~~ **Moot as of 2026-07-24 (D29):** the digest feature this localized was fully retired — see phase 5 task 4.
2. Bad-translation feedback: long-press a translated card/reader → prefilled feedback mail (`FEEDBACK_EMAIL` constant, `apps/mobile/src/utils/feedback.ts`) with postId + lang; this is the data that decides whether the deferred verify pass (DESIGN §12) gets built. (The separate standalone Settings "Send feedback" row this constant also powered was removed 2026-07-24, D29 — this long-press path is unaffected.)
3. Cost Explorer review one week after phases 8–9 are live: per-tag spend vs. the §10 model; record the go/no-go on the separate verify pass in the decision log. **Amended 2026-07-24 (D31, phase 12):** the "tune the four cap env vars" half of this task is moot — caps no longer exist. This review's purpose shifts entirely to informing the phase-12 cost recheck (real spend data, since the §10 model's "at-cap" numbers stopped being meaningful).
4. ~~Runbook additions (phase-6 doc): stuck TranslateQueue DLQ, compact-generation failure spike, cap-tuning playbook.~~ **Amended 2026-07-24 (D31, phase 12):** replace the cap-tuning playbook with an uncapped-spend response playbook (what to do when the $10 Budget alarm fires, now that it's a monitoring-only signal with no cap lever to pull).
5. Leftover UX debt from 7–9 (bar spacing, reader typography, stub palette) — small, listed, time-boxed.

**Acceptance criteria**

- [x] ~~A non-EN user's digest arrives in their language.~~ Moot — digest retired (D29).
- [ ] The week-after cost review is written down (numbers + any cap changes + verify-pass decision) in the decision log or §10.
- [ ] Two weeks of daily use with no manual intervention: no DLQ alarms from the new queues, feed + reader feel right in your own daily use. (Caps no longer exist as of D31/phase 12 — this criterion drops "caps holding".)

---

## Phase 11 — UI component library adoption

**Goal:** unify all UI components — especially buttons — behind a single component library (D26) so future screens stop growing ad hoc custom primitives.

**Tasks**

1. Add `react-native-paper` (pure JS, no native linking — confirmed Expo-Go-safe) as a mobile dependency; wrap the app root in `PaperProvider` with full stock `MD3LightTheme`/`MD3DarkTheme` (D26 — no custom theme seed).
2. Replace every custom button across the app (feed actions, bottom action bar, settings rows, onboarding CTA, reader controls) with Paper's `Button`/`IconButton`.
3. Full component sweep: replace custom cards, inputs (language/topic pickers), badges (translated badge, topic chips), and modals/dialogs with Paper's `Card`, `TextInput`/segmented controls, `Badge`/`Chip`, and `Modal`/`Dialog` equivalents.
4. Remove now-unused custom component files and the styles/tokens Paper's theme supersedes.
5. Verify Expo Go compatibility live on a physical device — no native-module crash on launch (per the `expo-go-native-module-constraint` memory).

**Acceptance criteria**

- [x] Every button in the app is a Paper `Button`/`IconButton`; no ad hoc `Pressable`+`Text` button remains.
- [x] Full component sweep complete: cards, inputs, badges/chips, and modals all use Paper components (no modal/dialog UI exists anywhere in `apps/mobile/src` — confirmed via grep — so there was nothing to migrate for that part of the sweep).
- [ ] App boots and renders correctly in plain Expo Go on a physical device — no native-module crash. **Not verified**: no Android SDK/Xcode in this environment (maintainer's own step, same as every prior phase). `expo export` for both `android`/`ios` bundled cleanly as a proxy check.
- [x] `pnpm lint && pnpm typecheck && pnpm test` green.
- [ ] No visual regressions on feed, reader, settings, onboarding, saved, and history screens (manual pass on device). **Not verified** — same on-device gap as above.

---

## Phase 12 — Eager translation pipeline + on-demand progress

**Goal:** every feed card is already translated into the user's language before it's ever served — no pop-in — the compact reader keeps generating on demand but shows real staged progress instead of a spinner, and no daily LLM cap exists anywhere in the pipeline (D27 + D31, amends D11/D22/D23).

**Tasks**

1. **Remove all daily LLM caps (D31), first:** delete the cap-checking code entirely — `transformArticle`, `translateArticle`, and `contentArticle` stop calling `CountersRepo.incrementIfUnderCap` and never take a cap-based skip/degrade branch (the LLM call always proceeds; non-cap degrade paths like source-fetch failure or LLM refusal are untouched). Remove `transforms#<date>` (global), `transforms#<sourceId>#<date>` (per-source), `translations#<date>`, and `compacts#<date>` entirely. Remove `Sources.dailyQuota` (the per-source override field) alongside its check. Delete the `Counters` DynamoDB table (`infra/storage.ts` + wiring) and `CountersRepo` once nothing references it. `transform=skipped` no longer exists as a post state — only `llm`/`excerpt`. Do this before task 2, since it removes the exact cap logic task 2 would otherwise need to reconcile against.
2. **Eager enqueue at transform time:** `transformArticle` enqueues one `TranslateQueue` job per non-English language (ru/uk/pl) for every post immediately after summarization, instead of the feed handler's lazy per-request enqueue.
3. **Retire the feed-path lazy mechanism:** remove `i18nPending` stamping (including the field on `Posts`) and the feed-read-triggered enqueue (`enqueueTranslations` call site in `feed.ts`); `selectCardVariant`'s fallback logic is unchanged (still serves EN when a translation is genuinely missing — e.g. mid-flight or failed), but the pop-in badge no longer fires for feed cards.
4. **Content endpoint → job-based polling API:** redesign `GET /v1/posts/{postId}/content` into `POST /v1/posts/{postId}/content` (starts generation, returns `{ jobId, status: "pending" }`) + `GET /v1/posts/{postId}/content/status?jobId=` (returns `{ stage: "fetching"|"extracting"|"translating"|"done", available, content? }`); add minimal job-state storage (small DynamoDB item or S3 object, short-lived) so polling survives Lambda cold starts. `Sources.compactEnabled` (the rights kill switch, D23) stays — it isn't a cost cap and D31 doesn't touch it.
5. **Reader progress bar:** replace the reader's spinner with a staged progress indicator driven by real polling of the new status endpoint.
6. **New posts only:** no backfill of the historical backlog (per D27).

**Acceptance criteria**

- [ ] Zero references to `CountersRepo`, `dailyQuota`, `incrementIfUnderCap`, or the `Counters` table remain anywhere in `packages/`/`infra/` (grep-confirmed) — the LLM call in transform, translate, and compact all proceed unconditionally.
- [ ] A freshly ingested post has all 4 language variants (`i18n` populated for ru/uk/pl, English is the source) before any feed request ever serves it — verified via `Posts` item inspection right after a pipeline run, with no feed read in between.
- [ ] No feed card ever shows the `isTranslated` pop-in transition; a card renders in the target language (or English fallback, if genuinely still in flight) from its first appearance.
- [ ] The reader shows real staged progress (fetching → extracting → translating → done) that advances in step with the actual backend job, not a fixed-timer animation.
- [ ] `Sources.compactEnabled` (kill switch) still works exactly as before — flipping it false still routes a source's cards straight to the browser (confirms D31 didn't touch this unrelated guardrail).
- [ ] Cost Explorer spend one week after rollout is checked and written down in the decision log against DESIGN §10's "no longer computable" framing — this is the first real data point for what uncapped spend actually costs.
- [ ] All gates green; deployed to dev; exercised end-to-end on a physical device (feed shows no pop-in, reader shows staged progress).

---

## Phase 13 — LLM provider swap (OpenRouter)

**Goal:** all three LLM pipeline paths (card transform, translation, compact-article) call OpenRouter instead of Bedrock by default, using the same model (`anthropic/claude-haiku-4.5`) with no prompt/behavior change; Bedrock stays in the codebase as a dormant, env-switchable fallback (D32, amends D6).

**Tasks**

1. `packages/core/src/llm/openRouterClient.ts`: `createOpenRouterProvider(apiKey, model): LlmProvider`, calling OpenRouter's OpenAI-compatible chat-completions endpoint via Node 22's built-in `fetch` — same shape as `bedrockClient.ts`'s `complete(prompt): Promise<string>`, no new dependency.
2. `packages/core/src/llm/providerFactory.ts`: `createConfiguredLlmProvider(env)` — a pure, unit-testable function that reads `LLM_PROVIDER` (default `'openrouter'`) and returns either the OpenRouter or Bedrock provider, reusing the existing `createBedrockClient`/`createBedrockProvider` for the fallback branch. Export both from `packages/core/src/index.ts`.
3. `infra/pipeline.ts`: add `const openRouterApiKey = new sst.Secret('OpenRouterApiKey')`; add `OPENROUTER_MODEL_ID` (default `'anthropic/claude-haiku-4.5'`) and `LLM_PROVIDER` (default `'openrouter'`) constants alongside the existing `BEDROCK_MODEL_ID`; link the secret and add both new env vars to the three functions that currently receive `BEDROCK_MODEL_ID` (the transform consumer, translate consumer, content-job consumer). Leave the existing `bedrock:InvokeModel` IAM permission blocks and `BEDROCK_MODEL_ID` wiring untouched — the fallback needs them live.
4. Rewire `packages/functions/src/pipeline/transform.ts`, `translate.ts`, and `contentJob.ts`: replace each handler's `getBedrockProvider = lazy(() => createBedrockProvider(createBedrockClient(), requireEnv('BEDROCK_MODEL_ID')))` with a call to `createConfiguredLlmProvider(process.env)`.
5. Tests: unit tests for `openRouterClient.ts` (mocked global `fetch` — success, non-OK response, missing/malformed content) and `providerFactory.ts` (both branches, missing required env). No changes needed to `generateCard`/`translateCard`/`compactArticle` tests — they depend only on the `LlmProvider` interface.
6. Maintainer sets the real secret once per stage, outside any AI session: `npx sst secret set OpenRouterApiKey <value> --stage dev` and again `--stage production`.
7. Deploy to `dev`; confirm a real transform/translate/compact call completes via OpenRouter (CloudWatch logs show the OpenRouter request, not a Bedrock ARN) with `LLM_PROVIDER` unset (default). Then temporarily set `LLM_PROVIDER=bedrock` on `dev` only, redeploy, confirm the fallback path still produces a working transform, and revert.
8. Update DESIGN.md's D6 cross-references and cost/risk sections as needed if real OpenRouter billing data surfaces anything the D32 log entry didn't anticipate.

**Acceptance criteria**

- [x] `createConfiguredLlmProvider` is unit-tested for both the OpenRouter-default branch and the `LLM_PROVIDER=bedrock` branch, plus missing-required-env cases.
- [x] All three LLM call sites (transform, translate, contentJob) instantiate their provider via the shared factory, not `createBedrockProvider` directly.
- [ ] `OpenRouterApiKey` exists as an `sst.Secret`, set independently on both `dev` and `production`. **Blocked:** the `sst.Secret('OpenRouterApiKey')` resource is wired in `infra/pipeline.ts`, but the maintainer hasn't yet run `sst secret set OpenRouterApiKey <value> --stage dev`/`--stage production` in this environment.
- [ ] A live call on `dev` completes via OpenRouter with `LLM_PROVIDER` unset (verified via logs/response, not just "should work"). **Blocked on the secret being set** (see above) and a `sst deploy --stage dev`.
- [ ] Setting `LLM_PROVIDER=bedrock` on `dev` and redeploying still produces a working transform (fallback path proven live at least once), then reverted to the OpenRouter default. **Blocked**, same reason.
- [x] `pnpm lint && pnpm typecheck && pnpm test` green (304 vitest + 37 mobile-jest, up from 294 vitest).
- [x] No stale "Bedrock is the active provider" prose remains in DESIGN.md outside the explicit fallback framing (D32).

Code (tasks 1–5) is complete and verified via the unit test suite and a full `pnpm lint && pnpm typecheck && pnpm test` pass. Tasks 6–7 (setting the real secret, then deploying and live-verifying both the OpenRouter default and the Bedrock fallback) are the maintainer's own steps outside this session — no API key was generated, requested, or stored anywhere in code, tests, or commits.

---

## Phase 14 — CI/CD hardening

**Goal:** faster CI feedback, a real guardrail against breaking the deployed API against already-installed mobile clients, and a mobile app version that reflects what actually changed (D33–D35).

**Tasks**

1. **Parallel CI jobs (D33):** split `.github/workflows/ci.yml`'s single `quality` job into a `setup` job (installs deps once via `pnpm install --frozen-lockfile`, uploads `node_modules` as a build artifact) plus three jobs that depend only on `setup` and run in parallel: `lint` (`pnpm lint`), `typecheck` (`pnpm typecheck`), `test` (`pnpm test`). Update the `deploy` job's `needs:` from `quality` to `[lint, typecheck, test]`.
2. **Schema snapshot diff (D34, part 1):** add a script (`packages/shared/scripts/schemaSnapshot.ts`) that serializes every exported zod schema in `packages/shared/src/schemas.ts` (field names, optionality, primitive/enum shapes) to a committed JSON snapshot file (`packages/shared/schema-snapshot.json`). A new CI job (`schema-check`) regenerates the snapshot from the PR branch and diffs it against the committed one, failing if the diff contains a removed field, a narrowed/changed field type, or a removed enum value — additive changes (new optional field, new enum value) pass silently.
3. **Dev-stage E2E workflow (D34, part 2):** new `.github/workflows/e2e.yml`, triggered by `workflow_dispatch` and a schedule (daily), authenticating via the existing AWS OIDC role (scoped to `dev`-stage read/invoke permissions only). Two suites: (a) backend pipeline E2E — trigger a real ingest/transform/translate/content-job cycle against the deployed `dev` stage and assert the expected DynamoDB/SQS/S3 state transitions occur; (b) API-contract E2E — call the real deployed `dev` API over HTTP and parse every response through the same `packages/shared` zod schemas the mobile app itself uses, failing on any parse error. Neither suite touches production or runs on a PR.
4. **Mobile semver automation (D35):** a CI script (`scripts/bumpMobileVersion.ts`, run on merge to `main` when `apps/mobile/**` or `packages/shared/**` changed, mirroring `mobile-build.yml`'s existing path filter) that parses conventional-commit messages since the last mobile version tag, computes the next semver (`feat:` → minor, `fix:` → patch, `BREAKING CHANGE:`/`!` → major), writes the new version into `apps/mobile/app.json`, syncs `apps/mobile/package.json`'s `version` and `android/app/build.gradle`'s `versionName` to match, increments `versionCode` by 1, commits the bump, and tags it.
5. Fix the pre-existing version drift as part of task 4's first run: `app.json` (`0.0.1`), `package.json` (`0.0.0`), and `build.gradle` (`versionName "0.0.1"`, `versionCode 1`) are all out of sync today — reconcile them to one value before automation takes over.

**Acceptance criteria**

- [ ] `lint`, `typecheck`, and `test` run as separate parallel jobs in CI (confirmed via the Actions run graph — not just declared, actually overlapping in wall-clock time); `deploy` still only proceeds once all three pass.
- [ ] A deliberately-introduced breaking change to a `packages/shared` schema (e.g. remove a required response field) in a scratch PR is caught and fails the schema-snapshot-diff job; a purely additive change (new optional field) passes.
- [ ] The E2E workflow runs successfully against the real `dev` stage at least once (both suites), confirmed via its own Actions run, and never runs on a PR trigger.
- [ ] A merge to `main` touching `apps/mobile/**` with a `feat:` commit bumps the minor version automatically; `app.json`, `package.json`, and `build.gradle` all agree afterward; `versionCode` increased by exactly 1.
- [ ] `pnpm lint && pnpm typecheck && pnpm test` green (the new scripts/jobs themselves are covered by whatever unit tests make sense for the schema-diff and version-bump logic).

---

## Phase 15 — Eager compact-article generation

**Goal:** compact articles generate inside the ingest pipeline for all 4 languages, for every post, before any reader tap — no more on-demand/job-polling (D36, amends D23/D27).

**Tasks**

1. **Eager enqueue in `transformArticle`:** right after the raw-HTML archive step (independent of whether the card LLM call degrades to excerpt), enqueue one `ContentQueue` message per language (en/ru/uk/pl) for the post — same trigger point and independence-from-card-generation as the existing `TranslateQueue` enqueue (D27), but a separate queue since compact generation doesn't depend on card translation.
2. **Per-post figure-mirror dedup:** the content consumer, on the first message it processes for a given `postId` (check `Posts.mirroredFigures` — if absent, this is the first), extracts + mirrors that post's in-body figures once and writes the result to a new `Posts.mirroredFigures` field; every other per-language message for that post reads the stored list instead of re-extracting/re-mirroring. Guard against a races-on-first-message scenario (two language jobs for a brand-new post both see `mirroredFigures` absent and both mirror) — last-write-wins is acceptable here (same idempotency precedent as the existing compact-JSON S3 writes), or add a conditional write if double-mirroring in that narrow race proves wasteful enough to matter.
3. **Rename `ContentJobQueue` → `ContentQueue`, delete the `ContentJobs` DynamoDB table:** update `infra/pipeline.ts`, `packages/functions/src/pipeline/contentJob.ts` (rename to `content.ts` or similar — no more "job" concept), and `ContentJobsRepo` (delete entirely, same pattern as D31's `CountersRepo` removal). The consumer keeps its existing per-language logic (compactEnabled check → LLM call → write S3 + `compactLangs`) minus the job-stage-stamping wrapper D27 added (no more `updateStage('fetching'|'extracting'|'translating')` calls — nothing polls those stages anymore).
4. **Simplify the API route:** collapse `POST /v1/posts/:id/content` + `GET /v1/posts/:id/content/status?jobId=` into a single `GET /v1/posts/:id/content?lang=` that reads the S3 cache directly — cache hit returns `{ available: true, blocks, figures }`; miss returns `{ available: false, reason }` (compactEnabled false, or genuinely not ready yet — same typed shape, no jobId anywhere).
5. **Reader update:** `post/[id].tsx` drops the `ProgressBar`/job-polling `react-query` logic (phase 12's contribution) in favor of a plain fetch-and-render — a miss shows the existing "couldn't prepare" fallback (already built for the compactEnabled/error case) rather than a new UI state.
6. **New posts only:** no backfill Lambda for the historical backlog, matching D24/D27/D28's precedent.

**Acceptance criteria**

- [x] A freshly ingested post has all 4 compact-article language variants cached in S3 (`compactLangs` populated with all 4) within the pipeline's normal processing lag, with zero reader taps in between — verified the same way D27 verified eager translation (inspect `Posts` right after a pipeline run, no feed/reader interaction beforehand).
- [x] Figure extraction/mirroring runs exactly once per post (confirmed via CloudWatch logs or a mirror-call counter), not once per language — proves the dedup actually works, not just that 4 compacts exist.
- [x] Zero references to `ContentJobs`, `ContentJobsRepo`, `jobId`, or staged-progress stages (`fetching`/`extracting`/`translating` as job stages) remain anywhere in `packages/`/`infra/`/`apps/mobile` (grep-confirmed).
- [x] `GET /v1/posts/:id/content?lang=` returns real cached content on the common path and a typed `available: false` on a deliberately-forced miss (e.g. a source with `compactEnabled: false`), with no synchronous LLM call ever happening on this request path.
- [x] The reader renders a compact article immediately (no progress bar) on a cache hit, and falls back gracefully on a miss.
- [x] `pnpm lint && pnpm typecheck && pnpm test` green; deployed to `dev` and exercised end-to-end (a real ingest run producing eagerly-cached compacts in all 4 languages, confirmed via the CDN/S3 directly, not just the API).

---

## Phase 16 — Visual identity redesign ("Orbit") + native-asset sync fix

**Goal:** replace D30's violet/magenta lettermark with the new "Orbit" identity (navy background, amber ring-and-dot), and this time actually verify it reaches a real installed APK — fixing the sync gap D30 left behind (D37).

**Tasks**

1. **Root-cause fix, first:** confirm exactly which native resources are stale by decoding the current compiled files (`android/app/src/main/res/mipmap-*/ic_launcher*.webp`, `drawable-*/splashscreen_logo.png`, `values/colors.xml`'s `splashscreen_background`) — already done during this decision's own investigation, all confirmed still the default Expo template (`#208AEF` chevron), not D30's violet/magenta.
2. **Generate the new Orbit source assets:** SVG source (navy `#111A33` background, amber `#FF9F1C` ring-and-dot mark, flat/no gradients) rasterized locally via `sharp` (same tool D30 used, no design-tool dependency) into `apps/mobile/assets/images/` (icon, android adaptive-icon foreground/background/monochrome, favicon, splash-icon), matching D30's exact file set.
3. **Update `app.json`** (icon/adaptiveIcon/splash-screen config) and `LoadingScreen.tsx`'s background color to `#111A33` — regenerate its snapshot test.
4. **Surgically sync the committed `android/` project** — the actual fix for D30's gap: run `expo prebuild --platform android` into a scratch/throwaway location (or a temporary git worktree) with the updated `app.json`/assets, then copy only the icon/splash-derived generated files (the `mipmap-*/ic_launcher*`, `drawable*/splashscreen_logo.png`, and the `colors.xml` background value) into the real committed `apps/mobile/android/` tree. Do **not** run `expo prebuild --clean` directly on the committed project — that would regenerate `build.gradle` from scratch and wipe D18's hand-edited release-`signingConfig` block, which would then need to be manually reapplied. Diff the full scratch-prebuild output against the committed tree first to confirm nothing else unexpectedly changed before copying.
5. **Real verification, not a repeat of D30's gap:** build an actual APK (`./gradlew` or `eas build --local`), install it on a physical device or emulator, and visually confirm the new icon (home screen + app switcher) and splash screen render — decode the resulting APK's resources programmatically as a first check, then an actual on-device look, since decoding alone is what should have caught D30's gap and didn't get done.

**Acceptance criteria**

- [x] Decoding `android/app/src/main/res/mipmap-xxxhdpi/ic_launcher_foreground.webp` and `drawable-xxxhdpi/splashscreen_logo.png` shows the new Orbit ring-and-dot mark, not the Expo default chevron.
- [x] `values/colors.xml`'s `splashscreen_background` reads `#111A33`, not `#208AEF`.
- [x] `apps/mobile/android/app/build.gradle`'s release `signingConfig` block is byte-identical to before this phase (confirms the surgical sync didn't clobber D18's hand-edit) — confirmed via matching `sha256sum` before/after the sync.
- [ ] **Blocked, not deferred:** a real built APK, installed on a device/emulator, showing the Orbit icon and splash — this environment has no Android SDK, no `adb`/`gradle`, and no Java runtime at all (`ANDROID_HOME`/`ANDROID_SDK_ROOT` unset, no SDK at the default macOS path, `java -version` can't locate a runtime), so this is the maintainer's own step, same constraint every prior phase (7, 10, 11, 12) hit.
- [x] `pnpm lint && pnpm typecheck && pnpm test` green, including a regenerated `LoadingScreen` snapshot (294 vitest + 37 mobile-jest tests).

---

## Sequencing notes & standing risks

- Phases 0→3 are strictly ordered; 4–6 can interleave.
- Extension ordering (Q22/D20–D25): **7 → 8 → 9 → 10.** Phase 7 is independent and lands first (visible wins, zero new LLM spend). Phase 8 precedes 9 because the reader consumes the language preference, serving contract, and translation machinery that 8 builds. Phase 10 needs real usage of 8+9 to review. Phases 7–9 don't block on phase 5's remaining EAS setup or phase 6.
- Second extension (2026-07-24, D26–D31): **11 → 12** — 11 shipped (`react-native-paper` adopted, see CLAUDE.md). Phase 12 touches the reader UI that phase 11's component sweep also touched, so it lands after. Phase 12 depends on phase 8's `TranslateQueue`/translate-consumer machinery and phase 9's content endpoint — it amends both rather than replacing them, and also removes the daily-cap mechanism phases 3/8/9 each built (D31).
- Third extension (2026-07-24, D32): **13**, standalone — it's a pure transport swap behind the existing `LlmProvider` interface, so it has no dependency on 11 or 12 and could in principle land before them; ordered last here only because it was decided last.
- Fourth extension (2026-07-24, D33–D35): **14**, standalone — CI/CD process changes with no dependency on phase 13's provider swap or any other phase's application code; could land independently, in any order, alongside it.
- Fifth extension (2026-07-24, D36): **13 → 15** — the user explicitly asked for this after the OpenRouter swap, and phase 15's own reasoning depends on it: the eager-compact cost multiplier is only an acceptable tradeoff because D32 already moved LLM spend off the AWS Budget alarm and D31 already removed caps. Phase 15 also reuses phase 12's eager-enqueue pattern (D27) as its template and touches the same reader screen phases 9/11/12 built, so it lands after all of those; it has no dependency on phase 14's CI/CD work.
- Sixth extension (2026-07-24, D37): **16**, standalone — a mobile-asset/build-pipeline fix plus a redesign, with no dependency on 13/14/15's backend work. Surfaced by the user actually performing the on-device APK check every prior phase (7, 10, 11, 12) had deferred to "the maintainer's own step" without ever running — a reminder that a phase's own acceptance criteria checkbox staying unchecked is exactly the gap it's meant to flag, not a formality.
- The riskiest unknowns are front-loaded deliberately: DDB key design proves itself in phase 1 (read-exclusion at query time), pipeline semantics in phase 2 (dedup under concurrency), LLM economics in phase 3 (cap mechanics, later removed by D31) — and in the extension, on-demand economics in phase 8 (caps/quotas before new spend exists, later removed) and the rights guardrails at the start of phase 9 (the kill switch before the feature — this one stays, D31 only removed cost caps, not rights guardrails). Phase 12 repeats the front-load pattern once more: its task 1 is removing the cap mechanism entirely, before any eager-enqueue code is written on top of it. Phase 13 has no analogous risk to front-load — the provider swap is contained entirely behind the pre-existing `LlmProvider` interface, which is precisely why it's low-risk enough to sequence last. Each phase's acceptance criteria exist to force that proof.
- Standing rule from DESIGN §2: content-level failures degrade (excerpt cards; for translations, degrade *is* the English fallback; for compacts, the direct link-out), infra-level failures alarm (DLQ). Any new pipeline code follows the same split.
- Every LLM call goes through one of three defined paths — transform, translate (eager as of D27/phase 12), compact (eager as of D36/phase 15) — with no daily cap on any of them as of D31/phase 12, and no usage-gating (taps) left on any of them as of D36/phase 15. No ad-hoc LLM-provider calls outside those three paths, regardless of which provider (OpenRouter or Bedrock, D32/phase 13) is active.
- After phase 3, re-read DESIGN §12 (deferred defaults) and promote/kill items deliberately rather than by drift; same review after phase 10 and after phase 12 (the first real Cost Explorer read under uncapped spend, D31). Phase 13 shifts that spend off Cost Explorer entirely (D32) — its own equivalent check is against OpenRouter's dashboard, not §12.
