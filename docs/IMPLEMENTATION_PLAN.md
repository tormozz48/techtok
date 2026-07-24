# TechTok — Implementation Plan

Companion to [DESIGN.md](DESIGN.md). Twelve phases (0–6 original build-out, 7–10 the 2026-07-22 extension, D20–D25, 11–12 the 2026-07-24 extension, D26–D30); every phase ends with something you can demo on a phone. Effort estimates are focused solo days — spread over evenings, multiply accordingly.

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
| 12 | Eager translation pipeline | eager TranslateQueue enqueue, job-polling content API, progress bar | 3–4 d |

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
4. **Translate stage (D22):** `TranslateQueue` + DLQ infra (ESM `maxConcurrency: 2`); feed-path conditional enqueue with `i18nPending` markers; consumer Lambda → self-critique-in-call translation (zod, one repair-retry, golden fixtures per language) → write `i18n[lang]`; content failures clear the marker and stay EN, infra failures throw to DLQ.
5. **Caps & quotas (D22):** `translations#<date>` counter (default 100/day) in the translate consumer; per-source `transforms#<sourceId>#<date>` quota (default 30/day, `Sources.dailyQuota` override) gating only the LLM call in `transformArticle`; check whether Hugging Face has an official-posts-only feed URL and switch `Sources` if so.
6. **Chrome i18n (D20):** `expo-localization` + typed string tables (settings/history/saved/onboarding/reader strings); language driven by the same stored preference; localized topic labels rendered from shared.
7. ~~**Digest guard:** digest builder picks the user's language variant when present (full localization polish lands in phase 10).~~ **Moot as of 2026-07-24 (D29):** the digest feature this guarded was built here, then fully retired — see phase 5 task 4 and phase 10 task 1.

**Acceptance criteria**

- [ ] Switching to RU on a device: chrome flips immediately; the feed's next refresh serves translated cards for previously-viewed posts (pop-in demonstrated: first EN with badge, translated after the queue drains).
- [ ] Two devices with different languages have fully independent content languages against the same posts.
- [ ] Set the translation cap to 3 and scroll: exactly 3 posts gain `i18n` entries, the rest stay EN and re-enqueue on a later day (verified via `Counters` + post items).
- [ ] HF (or any source) hits its per-source quota in a live cycle: its overflow posts land as `transform=skipped` excerpt cards while other sources still get LLM cards the same day.
- [ ] Verbatim-excerpt posts translate too (Q6/D20) and read acceptably on a device.
- [ ] All gates green; deployed; exercised on a physical device.

---

## Phase 9 — Compact reader

**Goal:** tap a card, read a compact translated version of the article with its figures in-app, then jump to the original if hooked (D23). The rights guardrails exist before the feature does.

**Tasks**

1. **Guardrails first (D23):** `Sources.compactEnabled` (default true, per-source off switch) + `compacts#<date>` cap (default 20/day) — both checked before any generation; document remove-on-request in the ops runbook.
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
- [ ] Set the compact cap to 2: third tap of the day degrades to the browser; `Counters` confirms.
- [ ] All gates green; deployed; the full card → reader → original loop demonstrated on a physical device.

---

## Phase 10 — Extension polish & cost truth

**Goal:** the extension earns its keep in daily use and provably stays inside the budget posture (D22).

**Tasks**

1. ~~Digest localization end-to-end: push text uses the recipient's language (generate/fetch translations for the top-5 the same on-demand way, under the translation cap).~~ **Moot as of 2026-07-24 (D29):** the digest feature this localized was fully retired — see phase 5 task 4.
2. Bad-translation feedback: long-press a translated card/reader → prefilled feedback mail (`FEEDBACK_EMAIL` constant, `apps/mobile/src/utils/feedback.ts`) with postId + lang; this is the data that decides whether the deferred verify pass (DESIGN §12) gets built. (The separate standalone Settings "Send feedback" row this constant also powered was removed 2026-07-24, D29 — this long-press path is unaffected.)
3. Cost Explorer review one week after phases 8–9 are live: per-tag spend vs. the §10 model; tune the four cap env vars deliberately; record the go/no-go on the separate verify pass in the decision log.
4. Runbook additions (phase-6 doc): stuck TranslateQueue DLQ, compact-generation failure spike, cap-tuning playbook.
5. Leftover UX debt from 7–9 (bar spacing, reader typography, stub palette) — small, listed, time-boxed.

**Acceptance criteria**

- [x] ~~A non-EN user's digest arrives in their language.~~ Moot — digest retired (D29).
- [ ] The week-after cost review is written down (numbers + any cap changes + verify-pass decision) in the decision log or §10.
- [ ] Two weeks of daily use with no manual intervention: no DLQ alarms from the new queues, caps holding, feed + reader feel right in your own daily use.

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

**Goal:** every feed card is already translated into the user's language before it's ever served — no pop-in — while the compact reader keeps generating on demand but shows real staged progress instead of a spinner (D27, amends D22/D23).

**Tasks**

1. **Cost/cap recheck first (D27's own precondition):** recompute the `translations#<date>` daily cap needed to cover eager volume (~3 languages × every LLM-carded post) and reconcile the whole model against the $10/mo budget (D11) per DESIGN §10 — likely by lowering the global `transforms#<date>` cap rather than raising the budget. Do this before wiring the eager enqueue, not after.
2. **Eager enqueue at transform time:** `transformArticle` enqueues one `TranslateQueue` job per non-English language (ru/uk/pl) for every post immediately after summarization, instead of the feed handler's lazy per-request enqueue.
3. **Retire the feed-path lazy mechanism:** remove `i18nPending` stamping and the feed-read-triggered enqueue (`enqueueTranslations` call site in `feed.ts`); `selectCardVariant`'s fallback logic is unchanged (still serves EN when a translation is genuinely missing — e.g. mid-flight or failed), but the pop-in badge no longer fires for feed cards.
4. **Content endpoint → job-based polling API:** redesign `GET /v1/posts/{postId}/content` into `POST /v1/posts/{postId}/content` (starts generation, returns `{ jobId, status: "pending" }`) + `GET /v1/posts/{postId}/content/status?jobId=` (returns `{ stage: "fetching"|"extracting"|"translating"|"done", available, content? }`); add minimal job-state storage (small DynamoDB item or S3 object, short-lived) so polling survives Lambda cold starts.
5. **Reader progress bar:** replace the reader's spinner with a staged progress indicator driven by real polling of the new status endpoint.
6. **New posts only:** no backfill of the historical backlog (per D27).

**Acceptance criteria**

- [ ] A freshly ingested post has all 4 language variants (`i18n` populated for ru/uk/pl, English is the source) before any feed request ever serves it — verified via `Posts` item inspection right after a pipeline run, with no feed read in between.
- [ ] No feed card ever shows the `isTranslated` pop-in transition; a card renders in the target language (or English fallback, if genuinely still in flight) from its first appearance.
- [ ] The reader shows real staged progress (fetching → extracting → translating → done) that advances in step with the actual backend job, not a fixed-timer animation.
- [ ] `translations#<date>` cap holds under real eager volume; hitting the cap mid-day is visible in `Counters` and does not crash the transform pipeline (excess posts simply don't get pre-translated that day and fall back to English).
- [ ] Cost Explorer spend one week after rollout is checked against the recomputed §10 model; the decision log is updated with the real numbers (task 1's recheck was a prediction, this closes the loop).
- [ ] All gates green; deployed to dev; exercised end-to-end on a physical device (feed shows no pop-in, reader shows staged progress).

---

## Sequencing notes & standing risks

- Phases 0→3 are strictly ordered; 4–6 can interleave.
- Extension ordering (Q22/D20–D25): **7 → 8 → 9 → 10.** Phase 7 is independent and lands first (visible wins, zero new LLM spend). Phase 8 precedes 9 because the reader consumes the language preference, serving contract, and translation machinery that 8 builds. Phase 10 needs real usage of 8+9 to review. Phases 7–9 don't block on phase 5's remaining EAS setup or phase 6.
- Second extension (2026-07-24, D26–D30): **11 → 12**, both independent of phases 0–10 and of each other in principle, but ordered 11-then-12 since phase 12 touches the reader UI that phase 11's component sweep also touches (avoid landing both in the same screens concurrently). Phase 12 depends on phase 8's `TranslateQueue`/translate-consumer machinery and phase 9's content endpoint — it amends both rather than replacing them.
- The riskiest unknowns are front-loaded deliberately: DDB key design proves itself in phase 1 (read-exclusion at query time), pipeline semantics in phase 2 (dedup under concurrency), LLM economics in phase 3 (cap mechanics) — and in the extension, on-demand economics in phase 8 (caps/quotas before new spend exists) and the rights guardrails at the start of phase 9 (the kill switch before the feature). Phase 12 repeats this pattern: its task 1 is the cost/cap recheck, before any eager enqueue code is written. Each phase's acceptance criteria exist to force that proof.
- Standing rule from DESIGN §2: content-level failures degrade (excerpt cards; for translations, degrade *is* the English fallback; for compacts, the direct link-out), infra-level failures alarm (DLQ). Any new pipeline code follows the same split.
- Every LLM call goes through a capped path — transform (global cap + per-source quota), translate (eager as of D27/phase 12), compact (D22). No ad-hoc Bedrock calls.
- After phase 3, re-read DESIGN §12 (deferred defaults) and promote/kill items deliberately rather than by drift; same review after phase 10 and after phase 12 (the eager-translation cost recheck).
