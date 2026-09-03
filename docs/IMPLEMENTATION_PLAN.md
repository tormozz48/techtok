# TechTok — Implementation Plan

Companion to [DESIGN.md](DESIGN.md). Eighteen phases (0–6 original build-out, 7–10 the 2026-07-22 extension, D20–D25, 11–12 the 2026-07-24 extension, D26–D30, 13 the 2026-07-24 LLM provider swap, D32, 14 the 2026-07-24 CI/CD hardening, D33–D35, 15 the 2026-07-24 eager compact-article generation, D36, 16 the 2026-07-24 visual identity redesign + native-asset sync fix, D37, 17 the 2026-07-25 public project site on GitHub Pages, D39, 18 the 2026-08-03 release history feed, D60, **19–22 the 2026-08-10 going-public-and-paid stage, D67–D74**, 23 the 2026-08-13 free-first Play launch re-sequence, D75, **24 the 2026-08-31 relational data layer, D90**); every phase ends with something you can demo on a phone. Effort estimates are focused solo days — spread over evenings, multiply accordingly.

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
| 17 | Public project site on GitHub Pages | New `apps/site` (Astro) workspace package, `deploy-site.yml` release-pipeline stage, non-prerelease APK releases | 1 d |
| 18 | Release history feed | Build-time git-tag read (`apps/site/src/lib/releases.ts`), new site section, `deploy-site.yml` full-history checkout | <1 d |
| 19 | Google identity | API GW JWT authorizer (Google issuer), native Google Sign-In, `userId` = `g:<sub>`, live user-data wipe, `DELETE /v1/me` | 2–3 d |
| 20 | Entitlements & quota | Entitlement model + manual grants, daily counters on `Users`, feed/reader gating, paywall screen | 2–3 d |
| 21 | Play Billing | `PlayServiceAccountKey` secret, Play Developer API verification, IAP client, Play Console subscription products | 3–4 d |
| 22 | Extended compact (paid) | 4th LLM path, `POST /v1/posts/:id/extended`, fair-use cap, reader integration | 2 d |
| 23 | Public Play launch (free) — **runs before 21–22** | Deploy/verify 19–20, upload keystore + AAB pipeline, legal surface on `apps/site`, Play listing, 14-day closed test | 3–4 d work, ~4–6 weeks elapsed |
| 24 | Relational data layer (Neon + Drizzle, D90) | Neon Postgres per stage (`NeonDatabaseUrl` secret), normalized 15-table schema, Drizzle over `neon-http`, PGlite test harness, DynamoDB removal | ~9 d + 2-week soak |

**Release gate (parallel, maintainer-side, D67, re-scoped by D75).** Not a phase — it blocks *shipping*, not coding. D75's free-first ordering splits it in two: items 1–4 block the free public launch (phase 23) and start now, because the longest takes 14 calendar days plus an approval wait; items 5–6 block monetization only and are not on the launch critical path.

*Blocks the free launch (phase 23):*

1. **Rights review** for a public app built on third-party article condensations (challenged assumption #4, re-resolved by D67/D72; due for *any* public release, not just a paid one). At free-first scope the question narrows to what actually ships: D23/D36's existing ~400–600-word compacts with attribution and link-out. Decide whether any source is excluded, and whether `transform=excerpt` posts should drop out of translation eligibility now that D20's friends-scale acceptance no longer holds. The *paid*-tier question (does a 1,500-word condensation substitute for the original?) defers with phase 22.
2. **Play Console:** developer account ($25 one-time, personal per D75 — so item 4 applies), app listing, content rating (IARC), target-API compliance, **no News category** (it carries publisher-transparency requirements this app can't meet) — pick a neutral alternative such as Books & Reference.
3. **Legal/compliance surface** (none of which exists today — `apps/site/src/pages` holds only `index.astro` and `[lang]/index.astro`): privacy policy hosted on the project site (D39), Data Safety form matching what D68 actually stores, and a **public web account-deletion URL** alongside the in-app `DELETE /v1/me` — Play requires the web route to be reachable without installing the app. Terms of service are not required for a free app and land with item 5.
4. **12 testers × 14 continuous days** closed test before production access can even be applied for; the application itself then takes days more. Personal account (D75), created after Nov 2023, so **no exemption applies**. **Longest-lead item in the entire project; start it the day phase 23 produces an uploadable AAB.** Confirm 12 real Google accounts can be fielded before phase 23 begins — this is the single assumption most likely to slip the date.

*Blocks monetization only (phases 21–22):*

5. **Subscription products** in Play Console: one product, two base plans (€2.99/mo, €24.99/yr), no offers (D73), plus terms of service covering the subscription.
6. **Paid-scope rights review** — the deferred half of item 1, gating phase 22's scope. If it lands badly, the paid tier is redefined to sell only our own features (unlimited reading, offline, listen mode, stats), which is an entitlement-check change, not an architecture change.

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
2. Step Function `IngestPipeline`: LoadSources → Map(FetchSource, concurrency 4, per-item Catch → `failCount`/`lastStatus`) → Summarize (EMF metrics). EventBridge `rate(60 min)`. Conditional GET via stored `etag`/`lastModified`.
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
- Offline: explicit prefetch of next N cards + images on wifi. *(Images only as of D82 — the article-content half was built by D55/D61 and removed again.)*
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

- [ ] A deliberately-broken source, a DLQ message, and a Bedrock throttle are all diagnosable from logs, alarms + runbook alone (the ops dashboard was retired by D89).
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

1. Add `react-native-paper` (pure JS, no native linking — confirmed Expo-Go-safe) as a mobile dependency; wrap the app root in `PaperProvider` with an MD3 theme seeded from the app icon's brand palette (D26, amended same-day to drop "no custom theme seed" once a real identity — D37 — existed to seed from).
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
3. **Dev-stage E2E workflow (D34, part 2):** new `.github/workflows/e2e.yml`, triggered by `workflow_dispatch` and a schedule (daily), authenticating via the existing AWS OIDC role (scoped to `dev`-stage read/invoke permissions only). Two suites: (a) backend pipeline E2E — trigger a real ingest/transform/translate/content-job cycle against the deployed `dev` stage and assert the expected DynamoDB/SQS/S3 state transitions occur; (b) API-contract E2E — call the real deployed `dev` API over HTTP and parse every response through the same `packages/shared` zod schemas the mobile app itself uses, failing on any parse error. Neither suite touches production or runs on a PR. **Amended 2026-07-25 (D38):** `e2e.yml` gained a `workflow_call` trigger so `ci.yml` invokes it directly as a required step between dev and production deploys on every merge to `main` — the schedule/dispatch triggers stay too, but it's no longer true that this workflow only runs on its own timer; it still never runs on a PR.
4. ~~**Mobile semver automation (D35):** a CI script (`scripts/bumpMobileVersion.ts`, run on merge to `main` when `apps/mobile/**` or `packages/shared/**` changed, mirroring `mobile-build.yml`'s existing path filter) that parses conventional-commit messages since the last mobile version tag, computes the next semver (`feat:` → minor, `fix:` → patch, `BREAKING CHANGE:`/`!` → major), writes the new version into `apps/mobile/app.json`, syncs `apps/mobile/package.json`'s `version` and `android/app/build.gradle`'s `versionName` to match, increments `versionCode` by 1, commits the bump, and tags it.~~ **Retired 2026-07-25 (D38):** `.github/workflows/mobile-version.yml` deleted — a standalone push-triggered auto-bump-and-repush no longer fits the linear release pipeline D38 introduced (`scripts/bumpMobileVersion.ts` still exists, runnable manually). ~~**Reinstated 2026-07-26 (D40):** the same bump/commit/tag logic now runs as a step inside `mobile-build.yml`'s `android` job (after `pnpm install`, before the Gradle cache/APK build) — the pipeline's one guaranteed pre-APK-build checkpoint turned out to be exactly the insertion point D38 said didn't exist. `scripts/bumpMobileVersion.ts` also gained a self-heal path for when the `mobile-v*` tag drifts from `app.json`'s actual version (as happened here, from manual bumps to `0.4.0` while the automation was off) — it reconciles to `app.json` without a spurious extra bump instead of scanning history since the stale tag.~~ **Retired again 2026-07-26 (D41), this time for good:** the predicted push race (flagged as an accepted risk in both D35's and D40's own text) happened for real on the very first post-reinstatement run — an unrelated PR merged to `main` mid-job, rejecting the version-bump push and skipping the Gradle/APK-build/release steps entirely. Both `mobile-build.yml` steps ("Bump mobile version", "Commit and tag if the version changed"), the `fetch-depth: 0` checkout they needed, `scripts/bumpMobileVersion.ts` + its test, and the `mobile:bump-version` package.json script are all deleted. `apps/mobile/app.json`'s version (and its `package.json`/`build.gradle` copies) is hand-edited before merging from now on — no CI push, no race. **Narrowly reinstated 2026-07-26 (D42):** `mobile-build.yml` regains one step, after a successful APK build + GitHub Release publish, that pushes a `mobile-v$VERSION` git tag (read from `app.json`, no commit, no branch push) if that tag doesn't already exist on `origin` — a tag push has no fast-forward requirement against `main`, so it can't hit D41's race. **The bump itself reinstated too, 2026-07-26 (D43), but differently targeted:** a new `pull_request`-triggered workflow computes the conventional-commit bump and commits it onto the PR's own head branch (via `stefanzweifel/git-auto-commit-action`, not hand-rolled git shell) — never onto `main`, respecting a manual bump already present in the PR. `main` itself is never pushed to by either D42 or D43.
5. Fix the pre-existing version drift as part of task 4's first run: `app.json` (`0.0.1`), `package.json` (`0.0.0`), and `build.gradle` (`versionName "0.0.1"`, `versionCode 1`) are all out of sync today — reconcile them to one value before automation takes over.

**Acceptance criteria**

- [ ] `lint`, `typecheck`, and `test` run as separate parallel jobs in CI (confirmed via the Actions run graph — not just declared, actually overlapping in wall-clock time); `deploy` still only proceeds once all three pass.
- [ ] A deliberately-introduced breaking change to a `packages/shared` schema (e.g. remove a required response field) in a scratch PR is caught and fails the schema-snapshot-diff job; a purely additive change (new optional field) passes.
- [ ] The E2E workflow runs successfully against the real `dev` stage at least once (both suites), confirmed via its own Actions run, and never runs on a PR trigger.
- [ ] ~~A merge to `main` touching `apps/mobile/**` with a `feat:` commit bumps the minor version automatically; `app.json`, `package.json`, and `build.gradle` all agree afterward; `versionCode` increased by exactly 1.~~ Moot as of 2026-07-25 (D38): the automation this checked was retired.
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

## Phase 17 — Public project site on GitHub Pages

**Goal:** a public landing page for the mobile app — what it is, its topics and sources, Orbit branding, and an always-current APK download (link + QR) — published automatically as a final stage of the existing release pipeline.

**Tasks**

1. **New `apps/site` workspace package (Astro, static output):** hero, a pure-CSS/SVG phone mockup, a features list, all 8 topics (`packages/shared`'s `TOPIC_LABELS`) and all 11 seed sources (`packages/core`'s `FULL_SOURCE_PRESETS`, exposed via a new `./ingest/sourcePresets` subpath export so the site never pulls in the core package's AWS-SDK-loading default barrel), and a download section with an inline SVG QR code + button. Localized to all 4 app languages (en/ru/uk/pl) via an unprefixed default-locale page plus a `[lang]` dynamic route, sharing one layout and one `SITE_COPY` copy module (mirrors `apps/mobile/src/i18n/strings.ts`'s one-file-all-languages discipline, D20).
2. **Redraw the Orbit mark as inline SVG:** D37's mark was never committed as a source file, only described in prose and baked into raster app assets — recreate it from that description (ring radius 216/stroke 52, dot radius 50 at −40° with a 34px gap, navy `#111A33`/amber `#FF9F1C`) for the header, favicon, and the CSS phone mockup.
3. **Stable APK link, permanently:** flip `mobile-build.yml`'s GitHub Release from `prerelease: true` to `prerelease: false` so `releases/latest/download/techtok.apk` resolves — the download button and QR both point at this one URL, which never needs reprinting as new builds ship.
4. **New `deploy-site.yml` reusable workflow:** `actions/configure-pages` → `astro build` → `actions/upload-pages-artifact` → `actions/deploy-pages` (`GITHUB_TOKEN` only, no AWS credentials) wired into `ci.yml` as the stage after `mobile-build`, gated the same way every other release-pipeline stage is (`main` only, never a PR).
5. **Version badge sourced from code:** read `apps/mobile/app.json`'s `version` (D35's canonical source) at build time rather than hand-copying it, so the site's version display can't drift from what's actually shipping.

**Acceptance criteria**

- [x] `pnpm lint && pnpm typecheck && pnpm test` green (336 vitest + 37 mobile-jest tests), including 3 new site-side vitest files.
- [x] `astro build` produces all 4 locale pages; all 4 browser-checked (desktop + mobile viewport widths) via a local `astro preview`.
- [x] The QR code extracted from the real build output decodes (via an ephemeral scratchpad `sharp`+`jsqr` install) to the exact stable APK URL.
- [x] Topics/sources/version rendered on the page match the live taxonomy/preset list/`app.json` exactly (sourced from the same code, not hand-copied).
- [ ] **Deferred, not blocked:** GitHub Pages isn't yet enabled on the repo (`actions/configure-pages`'s `enablement: true` may turn it on automatically on the first real run; otherwise it's a one-time Settings → Pages → Source: "GitHub Actions" step) — the maintainer's own step, since this environment has no write access to repo settings.
- [ ] **Blocked, not deferred:** an actual phone-camera scan of the deployed QR and a real Pages URL visit — needs the live deploy above to exist first.

---

## Phase 18 — Release history feed

**Goal:** the public site's landing page shows the 3 most recent mobile app releases — version, date, and a real Features/Fixes changelog — reusing the release infra that already exists (D42/D58), with zero new backend work and zero new network calls at build time (D60).

**Tasks**

1. **`apps/site/src/lib/releases.ts`:** a build-time module that shells out to `git` via `execFileSync` (mirrors `scripts/bumpMobileVersion.ts`'s existing pattern), lists `mobile-v*` tags (`git tag --list 'mobile-v*' --sort=-v:refname`), takes the newest `RELEASE_HISTORY_COUNT` (= 3 — a comment cross-references `release-cleanup.yml`'s `KEEP` so a future retention change doesn't silently desync the two, since they aren't wired to one shared constant), and for each tag reads its annotated message (`git tag -l --format='%(contents)'`, or `git for-each-ref`) plus its creation date. Parses the message's `### Features`/`### Fixes` sections (D58's own generated format) into a typed `{ version, date, features: string[], fixes: string[] }[]`. No tags, fewer than 3, or a parse miss degrades to however many entries are actually available — never throws, never fails the build (the project's content-level-failures-degrade philosophy, applied to the site build itself).
2. **`Releases.astro` component:** a new section composed into `Landing.astro` alongside Hero/Features/Topics/Sources/Download, with a `#releases` anchor matching the existing nav-anchor pattern (`#features`/`#topics`/`#sources`/`#download`). Renders each entry as version + localized date + Features/Fixes bullet lists. Changelog text itself stays English regardless of site locale (matches "ingest is English-only" — translating it would need a fourth ad hoc LLM call path outside the three the Hard Rules allow); an empty list (a brand-new repo with no tags yet) renders nothing rather than an empty section.
3. **`SITE_COPY` additions:** a `releases: { title, subtitle, featuresLabel, fixesLabel }` block across all 4 languages in `copy.ts`, plus a `nav.releases` label and anchor link in `Header.astro`'s existing nav — same one-file-all-languages discipline as the rest of `copy.ts`.
4. **`deploy-site.yml`:** checkout step gains `fetch-depth: 0` (mirrors `mobile-build.yml`'s existing use of full history) so `apps/site`'s build actually has the tags to read — a shallow checkout would silently see zero tags in CI even though a developer's full local clone works fine.
5. **Tests:** a vitest file for `releases.ts`'s pure parsing function (tag-message → `{ features, fixes }`) against sample D58-format changelog text — a normal Features+Fixes case, a Features-only case, a Fixes-only case, and the "_No user-facing feat/fix commits..._" fallback case. Matches the "unit-test the pure logic, don't mock the git shell-out" split `bumpMobileVersion.ts`'s own test file already uses.

**Acceptance criteria**

- [ ] `pnpm lint && pnpm typecheck && pnpm test` green, including the new `releases.ts` parser tests.
- [ ] `astro build` (run from a full local clone, tags present) produces a Releases section showing the 3 most recent `mobile-v*` tags with real version numbers, dates, and Features/Fixes bullets matching `git tag -n99` for those same tags.
- [ ] A scratch test with a shallow (`--depth 1`) clone confirms `releases.ts` degrades to an empty/partial list rather than throwing or failing the build.
- [ ] All 4 locales browser-checked: the section's chrome (title/subtitle/labels) is localized; changelog bullet text is English in every locale.
- [ ] Deployed: `deploy-site.yml` runs with `fetch-depth: 0` and the live site shows real tag data, not a placeholder.

---

## Phase 19 — Google identity

**Goal:** the app opens to a Google sign-in screen; after signing in you get your feed, and every API call is authenticated by a real verified token instead of a guessable header. Anonymous device identity is gone.

**Tasks**

1. **Front-load the destructive step.** Before any code: count `Users` and `UserActivity` rows on `dev` and `production`, export both tables to a scratchpad backup, print the exact counts, and get one explicit confirmation (CLAUDE.md Destructive Operations). The wipe (D68) is what makes the rest of this phase a rewrite rather than a migration, so it goes first — the same front-load-the-risk pattern phase 12 used for cap removal.
2. **Google Cloud project + OAuth clients:** an Android client (package name + SHA-1) and a Web client (whose ID is the `audience` the JWT authorizer checks and the `webClientId` the native SDK needs for an ID token). **Register the Play-managed SHA-1, not the local upload key** — D68's named failure mode; register the local debug SHA-1 too so debug builds work.
3. **JWT authorizer in `infra/api.ts`:** one `aws.apigatewayv2.Authorizer` (`jwt`, issuer `https://accounts.google.com`, audience = web client ID) attached to every `/v1` route except `GET /v1/topics` and `GET /v1/sources`. Verify SST v4 exposes this on `ApiGatewayV2.route()`; if it doesn't, `transform` on the route is the escape hatch.
4. **Server:** replace `extractDeviceId` with `extractUserId(event)` reading `requestContext.authorizer.jwt.claims.sub` → `g:<sub>`; delete `DEVICE_ID_HEADER` and `deviceId.ts`; `UsersRepo.touch` upserts on first sight and stores `email`, `name`, `timezone`. `X-Device-Language` stays (it still seeds a new user's language, D20).
5. **`DELETE /v1/me`:** deletes the `Users` row and paginates every `UserActivity` row for the user. A Play requirement (D68), built now rather than bolted on before listing.
6. **Mobile:** `@react-native-google-signin/google-signin` (Credential Manager). No `expo-secure-store` needed — the SDK persists its own session (Credential Manager), so `authStore.restore()` calls `signInSilently()` at app start instead of this app caching a token itself. `/auth` route gated via expo-router's `Stack.Protected`; `api/client.ts`'s `apiFetch` attaches `Authorization` and, on a 401, calls `refreshToken()` (a silent re-sign-in) and retries **once**; `/account` screen (email, sign out, delete account with a native confirm dialog). Zustand's device-UUID state is deleted.
7. **`expo prebuild` + Gradle debug build** — the Expo Go loop ends here (D67). Update `docs/DISTRIBUTION.md` to say so, and document the two-SHA-1 setup.
8. **Regenerate `packages/shared/schema-snapshot.json` deliberately.** D34's guardrail *will* fail on the removed `X-Device-Id` contract — that failure is correct and the regeneration is the deliberate act it's designed to force. Note it in the PR body.

**Acceptance criteria**

- [x] `pnpm lint && pnpm typecheck && pnpm test` green (296 files linted, 6 workspaces typechecked including infra, 49 vitest files/423 tests + 25 mobile-jest suites/142 tests); Metro bundle check passes (1802 modules, no errors).
- [ ] **Blocked, not deferred — no AWS credentials in this environment.** Backup taken, row counts printed, confirmation obtained, wipe executed on `dev` and `production`. `scripts/wipeUsers.ts` is written and ready (`pnpm wipe-users -- --stage dev`, then `--confirm`); the maintainer runs it.
- [ ] **Blocked — no Google Cloud project, no real device.** On a real device (debug build): cold open → Google sign-in sheet → feed loads. Force-quit and reopen → still signed in, no re-prompt.
- [ ] **Blocked — needs a deployed API GW authorizer.** A request with no `Authorization` header returns 401 **from the authorizer, not from handler code**; `GET /v1/topics` still works unauthenticated. (`infra/api.ts` typechecks against SST's generated types; behavior unverified against live AWS.)
- [ ] **Blocked — needs a real device + real tokens.** An expired ID token triggers exactly one silent refresh + retry, not a sign-out loop. Covered at the unit level: `apps/mobile/src/api/client.test.ts`-equivalent behavior is exercised via `authStore.test.ts`'s `refreshToken` tests, but the actual 401-retry path in `api/client.ts` has no live-server test.
- [ ] **Blocked — needs a deployed `UserActivity` table.** `DELETE /v1/me` removes the user row *and* every UserActivity row. Covered at the unit level: `UsersRepo.deleteUser`/`UserActivityRepo.deleteAllForUser` both have `aws-sdk-client-mock` tests (pagination + chunked `BatchWriteItem` included).
- [ ] **Blocked — needs two real devices.** Sign in on a second device with the same Google account → same history and bookmarks.

**Out of scope:** entitlements, quota, payments, extended compact.

**Implementation note:** built without `expo-secure-store` — Google Sign-In's SDK persists its own session (Android Credential Manager), so `authStore.restore()` calls `signInSilently()` at app start instead of this app caching a token. `/auth` gating uses expo-router's `Stack.Protected` rather than manual `router.replace` calls.

---

## Phase 20 — Entitlements & quota

**Goal:** the free tier is real and enforced — 50 card-reads and 10 reader-opens a day, a paywall when you hit either — and the whole paid experience is demoable on a phone **with no payment code in existence**, via manually-granted entitlements.

**Tasks**

1. **Entitlement model in `core` (D70):** `entitlement` on the `Users` item, an `isPlus(user, now)` predicate, and a provider-agnostic `grantEntitlement({ source: 'manual' | 'play', ... })` write path. Play is a *future* caller; nothing in this phase knows Play exists.
2. **Quota counters (D69):** `quota { day, cardReads, readerOpens }` on the `Users` item, atomic `ADD` with a conditional day-rollover reset against the user's stored IANA timezone. **Do not resurrect the `Counters` table** (D31). Watch for DynamoDB reserved keywords in the `UpdateExpression` — `day` and `status` are both reserved, and `aws-sdk-client-mock` will not catch it (the bug that bit phases 2 and 8).
3. **Enforcement:** `POST /v1/reads` increments `cardReads`; `GET /v1/feed` gains §5.2 step 8's page-granularity check returning `quotaExhausted`; `GET /v1/posts/:id/content` increments `readerOpens` and returns 402 when exhausted. Plus users skip all three branches.
4. **`GET /v1/me/entitlement`:** one call returning plan, expiry, both counters with limits, and `resetsAt` — the single source for every paywall surface.
5. **Ops script:** `scripts/grantEntitlement.ts` to grant/revoke `plus` by `userId` — how the maintainer tests the paid path in this phase and comps accounts forever after. Built as a local CLI tool (not a deployed Lambda), same tag-based table-discovery pattern as phase 19's `scripts/wipeUsers.ts` (extracted into a shared `scripts/lib/discoverTableName.ts` since both need it) — calls `UsersRepo.grantEntitlement` directly, the exact same write path Play's verify callback will use in phase 21.
6. **Mobile:** `/paywall` screen (plan comparison, both prices, no purchase button yet — a disabled "Coming soon"), a `QuotaBadge` indicator in the feed and a plan row in settings, and exhaustion states in the feed and reader that route to `/paywall`. All strings in all 4 languages (D20), Paper components (D26), stories for every new component and page (CLAUDE.md hard rule).

**Acceptance criteria**

- [x] `pnpm lint && pnpm typecheck && pnpm test` green (313 files linted, 6 workspaces + `scripts/` typechecked, 52 vitest files/456 tests + 26 mobile-jest suites/143 tests); Metro bundle check passes (1805 modules, no errors).
- [ ] **Blocked — no AWS credentials, no real device in this environment.** On a device, as a free user: read 50 cards → feed stops and the paywall appears; open 10 articles → the 11th shows the paywall, not an error. Covered at the unit level: `feed.ts`'s quota gate and `content.ts`'s 402 path are exercised indirectly via `UsersRepo.incrementQuota`/`isPlus`/`effectiveQuota` core tests, but the handlers themselves have no live-server test (matches this codebase's existing handlers-stay-thin/untested-at-the-handler-level convention).
- [ ] **Blocked — needs a deployed API + a real client.** Quota survives app restart and is enforced server-side — verified by calling the API directly with a fresh client, not just through the UI.
- [x] Reset fires at **local** midnight for a non-UTC timezone — verified at the unit level: `packages/core/src/entitlement/quota.test.ts` checks `nextLocalMidnightUtc`/`localDayKey` against both a positive-DST offset (Europe/Warsaw, UTC+2) and a negative offset (America/New_York, UTC-4), and `usersRepo.test.ts` exercises the actual day-rollover `UpdateCommand` conditional logic.
- [ ] **Blocked — needs AWS credentials.** `grantEntitlement` → the same account immediately reads unlimited cards and articles, with no app reinstall. The script itself typechecks and reuses the already-tested `UsersRepo.grantEntitlement`; running it against a live table is unverified in this session.
- [x] Prefetched/offscreen cards demonstrably do **not** burn quota: by construction, not just by observation — `POST /v1/reads` is the only call site that increments `cardReads` (`reads.ts`), and it only fires on the settle-based read event (§1), never on `GET /v1/feed` serving a page (nor on D61's prefetch, itself removed by D82). `feed.ts`'s quota gate only ever *reads* `effectiveQuota`, never increments it.
- [x] All 4 languages render the paywall and quota strings — `strings.ts`'s `paywall`/`quota` blocks are typed identically across `en`/`ru`/`uk`/`pl` (a missing key is a compile error, per the file's own stated convention), confirmed by `pnpm --filter mobile run typecheck`. Both color schemes read from `useThemeColors()`/`Colors.overlay.*` the same way every other screen does — no scheme-specific code path to verify separately. Real on-device visual check not done in this environment.

**Out of scope:** any real payment, the extended compact.

---

## Phase 21 — Play Billing

**Goal:** a real purchase on a real device from a real Play track grants `plus`, verified server-side.

**Tasks**

1. **Play Console setup** (release-gate items 2 and 4): app listing, subscription product with two base plans, license testers.
2. **`PlayServiceAccountKey` secret** (D71): Google Cloud service account with Play Developer API access, `sst secret set --stage dev|production`. **Check the deploying principals** before merging any `infra/` change here (CLAUDE.md AWS rule) — a new secret plus a new route is exactly the shape that has broken dev deploys before. Note this is a *GitHub Actions* repository secret consumed by `mobile-release.yml`'s Play submit step (D98), not (only) an `sst secret` for a Lambda — set it in both places if a Lambda-side verify call also ends up needing it (task 3 below).
3. **`POST /v1/billing/play/verify`:** validates the purchase token against `purchases.subscriptionsv2.get`, maps the result to an entitlement grant through phase 20's *unchanged* write path, and is idempotent (called on every app open). Verification logic lives in `core` behind an injectable Play API client so it is unit-testable with recorded fixtures and no live calls (CLAUDE.md hard rule).
4. **Mobile:** Play Billing client (`expo-iap`/`react-native-iap`), purchase flow from `/paywall`, `queryPurchases()` on app launch → verify → refresh entitlement, restore-purchases path, and a "Manage subscription" deep link into Play (Play owns cancel/upgrade/proration entirely — the server only reads the result).
5. **Track build + closed test kickoff:** produce an internal-track build via D18's Gradle path and start release-gate item 5's 14-day clock. IAP cannot be tested any other way.

**Acceptance criteria**

- [ ] `pnpm lint && pnpm typecheck && pnpm test` green; Metro bundle check passes.
- [ ] A license tester completes a real purchase from an internal-track build → `plus` is active within seconds, and the quota limits are gone.
- [ ] Verification is genuinely server-side: a forged/replayed purchase token is rejected — tested explicitly, not assumed.
- [ ] Calling verify twice with the same token doesn't double-grant or error.
- [ ] Cancel in Play → access continues to period end → lapses after expiry (verified with a test subscription's accelerated renewal timing).
- [ ] Reinstall + restore purchases → `plus` returns with no repurchase.
- [ ] Sign-in works in a **Play-signed** build, not just debug — the D68 SHA-1 trap, confirmed rather than assumed.
- [ ] Closed test running with ≥12 opted-in testers; day 1 of 14 logged with a date.

**Out of scope:** RTDN/Pub/Sub (D71 declined it), the extended compact.

---

## Phase 22 — Extended compact (paid)

**Goal:** a Plus subscriber taps "Read the long version" and gets a ~1,500-word condensation in their language, on demand.

**Tasks**

1. **Fourth LLM path (D72):** prompt in `packages/core/src/llm/prompts/`, reusing the *existing* compact block schema with a `variant: "extended"` marker so one reader component renders both and a failure degrades with zero UI branching. Golden-fixture tests, one repair-retry, ~16,000-char input truncation. Update CLAUDE.md's "three defined paths" hard rule, DESIGN §7.4, and the sequencing note below — all three say "three" today.
2. **`POST /v1/posts/:id/extended`** in its own Lambda (60 s timeout, separate from the thin content cache-read route) implementing §7.6's order: entitlement → fair use → CDN cache → `compactEnabled` → S3 archive → LLM → cache + `Posts.extendedLangs` + increment. Cache hits and failures both skip the fair-use increment.
3. **Fair-use cap (D73):** `fairUse { month, extendedCompacts }` on the `Users` item, monthly rollover, soft 429 that the reader presents as "you've hit this month's limit, here's the standard version".
4. **Mobile:** reader CTA (Plus badge for free users → `/paywall`), a real progress affordance for a 15–25 s wait — reuse D27's staged-progress thinking, since a bare spinner was already judged inadequate for an 11 s wait — and graceful degrade to the free compact on any failure.
5. **S3 lifecycle** for `content/<postId>/<lang>.extended.json`, matched to the existing 90-day TTL.

**Acceptance criteria**

- [ ] `pnpm lint && pnpm typecheck && pnpm test` green, including golden fixtures for the new path; Metro bundle check passes.
- [ ] On a device as Plus: tap → progress → a ~1,500-word extended article in the user's language, with attribution and "Read original" intact. Second tap on the same article returns from cache in well under a second **and doesn't increment fair use**.
- [ ] As free: the CTA shows a Plus badge and routes to `/paywall`; the endpoint returns 402 when called directly.
- [ ] A source with `compactEnabled: false` returns no extended compact — the D23 rights kill switch verified against the *paid* path specifically.
- [ ] A forced LLM failure degrades to the free compact **and leaves the fair-use counter unchanged** — verified by reading the counter, not by reading the code.
- [ ] Fair-use cap triggers the soft message at 100, not an error screen.
- [ ] Measured: real per-generation token cost recorded from OpenRouter's dashboard against D74's ≤€2/subscriber/month assumption. **This is the first real datapoint for D74's unit economics — record the number in the decision log, don't just eyeball it.**
- [ ] Rights review (release-gate item 1) complete, since it governs whether this phase ships as designed.

**Out of scope:** eager generation for subscribers, RTDN, iOS/StoreKit.

---

## Phase 23 — Public Play launch (free)

> **Ordering:** despite the number, this phase runs **immediately after phase 20 and before phases 21–22** (D75). It is numbered last only because it was decided last — the same convention phases 13, 17 and 18 already follow.

**Goal:** TechTok is publicly installable from Google Play as a free app: real sign-in, real feed, real reader, no payment code anywhere. Phases 19 and 20 stop being code-complete-but-unproven and become deployed-and-verified.

**Why this is mostly not a coding phase:** phases 19–20 have **zero** verified acceptance criteria between them (no deploy, no live wipe, no on-device pass), and the store work is dominated by credentialed, maintainer-only steps with real wall-clock latency. The four tracks below are deliberately parallel; only track A is a hard prerequisite for the others.

### Track A — Deploy and verify phases 19–20 (blocks everything else)

1. **Google Cloud project + OAuth clients** (phase 19 task 2, still undone): consent screen, a **Web** client (its ID is the JWT authorizer's `audience` and the native SDK's `webClientId`) and an **Android** client for `com.tormozz48dev.techtok`. Register the **local debug SHA-1** now; the Play-managed SHA-1 does not exist yet — see track C's ordering note, which is the single most important sequencing detail in this phase.
2. **Wire the client ID:** `GOOGLE_OAUTH_WEB_CLIENT_ID` at deploy time, `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` in `apps/mobile/.env`, and both added to `apps/mobile/.env.example` (phase 19 left this undone — that environment could not write the file).
3. **Run the D68 wipe:** `pnpm wipe-users -- --stage dev`, then `--confirm`; same for `production`. Follow CLAUDE.md's Destructive Operations rule — export both tables to a scratchpad backup and print exact row counts before confirming.
4. **Deploy both stages:** `pnpm exec sst deploy --stage dev`, verify, then let CI deploy `production`. Watch for the deploy-role trap in CLAUDE.md's AWS rule — phase 19 adds an `aws.apigatewayv2.Authorizer` and phase 20 adds a route, exactly the resource-shape that has broken dev deploys before with `AccessDenied`.
5. **Verify server-side, not through the UI:** a request with no `Authorization` header returns 401 **from the authorizer**; `GET /v1/topics` still works unauthenticated; `GET /v1/me/entitlement` returns the expected shape.
6. **Raise the quota constants out of reach** (D75d): `FREE_CARD_READS_PER_DAY` / `FREE_READER_OPENS_PER_DAY` in `packages/core/src/entitlement/entitlement.types.ts`. Enforcement code stays deployed and exercised — only the numbers change. Phase 21 restores D69's 50/10 in the same commit that enables purchases. Update phase 20's paywall copy so "Coming soon" is the only state a free user can reach.
7. **On-device pass** on a debug build: cold open → sign-in sheet → feed; force-quit → still signed in; reader, history, saved, search, listen mode, stats; account deletion removes the user *and* every `UserActivity` row; both color schemes; at least English and one Cyrillic locale.
8. **E2E credentials:** provision the dedicated test Google account and set `GOOGLE_TEST_REFRESH_TOKEN` + `GOOGLE_OAUTH_WEB_CLIENT_SECRET` so `packages/e2e`'s authenticated suites stop skipping.

### Track B — Legal & compliance surface (`apps/site`, D39)

9. **Privacy policy page**, derived from what the code actually does rather than from a template: identity data (email, name, Google `sub`, IANA timezone) from D68; behavioural data (read history, bookmarks, topic affinity, muted sources); processors (Google for auth, AWS `eu-central-1` for hosting, OpenRouter for condensation — which receives *article* text, never user data); retention and the deletion route. **English only** — machine-translating legal text into ru/uk/pl is a liability, not a feature; link all four locales at the one English page.
10. **Public account-deletion page:** Play requires a web URL reachable **without installing the app**. Documents the in-app path (`/account` → delete, which already calls `DELETE /v1/me`) plus an email route for people who have uninstalled. This is a Play requirement the in-app deletion alone does not satisfy.
11. **Link both from the site footer and the app's settings screen**, and record the URLs — the Play listing form asks for the privacy policy URL specifically.
12. **Data Safety form answers**, written down in the repo alongside the policy so the form and reality cannot drift: what is collected, what is shared, encryption in transit, deletion mechanism, and the fact that no data is sold and there is no advertising SDK.

### Track C — Signing chain and the AAB pipeline

13. **Establish signing credentials on EAS for the `production` profile** (maintainer, needs an EAS login): `npx eas-cli credentials --platform android`, select `production`, let EAS generate/store a keystore remotely. **No local keystore file, no `keystore.properties`** — this maintainer's build/deploy story is CI-only (never a laptop `./gradlew`/`eas build` run), so the credential source has to be EAS-managed (`credentialsSource: remote`, the `eas.json` default) rather than a file on disk. Mirrors exactly how the `preview` profile's credentials already work, per `docs/DISTRIBUTION.md`'s existing "Establish the Android keystore on EAS" one-time step — this is that same step, run once more for a second, isolated profile. `android/app/build.gradle`'s local-keystore fallback path (`keystore.properties`) stays in the repo for the documented no-EAS/local-Gradle alternative in `DISTRIBUTION.md`, but this maintainer doesn't use it.
14. ✅ **Make the store artifact an AAB, built by CI, not locally.** `eas.json`'s `production` profile was `"buildType": "apk"` / `"distribution": "internal"` — wrong on both counts for Play (an AAB isn't directly installable the way `internal` distribution assumes; `store` is the matching EAS concept for a Play-bound artifact). Now `"buildType": "app-bundle"` / `"distribution": "store"`. **`.github/workflows/mobile-release.yml`** runs `eas build --platform android --profile production --local --non-interactive` on the runner. As of D98 it is wired into `ci.yml`'s main-branch pipeline (a `mobile-play-release` job, gated on the same `should_build` signal as `mobile-build`) rather than `workflow_dispatch`-only, and submits the resulting `.aab` to the Play `internal` track via the Play Developer API once `PlayServiceAccountKey` (D71, phase 21 task 2 below) exists — until then it cleanly skips the submit and still uploads the AAB as a downloadable Actions artifact. No OTA publish yet (the `production` channel isn't bound, task 15 below). `eas build --local` doesn't run `apps/mobile`'s own `package.json` scripts, so task 16's API-URL guard runs as its own explicit CI step, before the build, reading the same `EXPO_PUBLIC_API_URL` the build step then bakes in.
15. ⚠️ **The OTA channel gap is bigger than first thought — no build, ever, has bound one.** Original read of this task assumed only the raw-Gradle path was missing a channel and that `eas build`/D65's CI publish already had it covered. Tracing `expo-updates`' actual Android source (`UpdatesConfiguration.kt`, corroborated against the iOS and controller source) shows the channel travels as an `expo-channel-name` request header, sourced from a manifest meta-data key that **`git log --all` confirms has never existed** in the committed `AndroidManifest.xml` — not for `preview`, not for `production`, since D18 first committed the native project. `eas.json`'s `"channel": "preview"` / `"channel": "production"` fields are therefore currently inert for Android; nothing reads them into a build. No live harm today, because D65 itself notes phase 5 has never had a real install to leave behind. **Fix, scoped to what phase 23 needs:** run `npx eas-cli update:configure --platform android` (maintainer-side, needs an EAS login) to bind the `production` channel before the first Play upload. Left deliberately out of scope here: giving the friends-distribution `preview` channel the same fix — that's phase 5's own dormant setup step, not a phase 23 blocker. See D65's amendment in DESIGN.md.
16. ✅ **Bake the production API URL, and fail loudly if it's wrong.** `scripts/checkProductionApiUrl.ts` (`pnpm check-api-url`, and wired as a hard prerequisite into `apps/mobile`'s `build:android`/`build:android:apk`) rejects an unset value, the exact placeholder `docs/DISTRIBUTION.md` ships, and anything that doesn't match an `eu-central-1` API Gateway HTTP API URL's shape. What it **can't** catch: `dev` and `production` are both opaque random `api-id`s in the same region, so shape alone can't prove which stage a well-formed URL points at — the script prints the resolved URL and asks for a human eyeball on that specific question, rather than claiming a certainty it doesn't have.
17. **Verify `targetSdkVersion`** against Play's current requirement for new apps. Currently unset in this repo — inherited as `35` from Expo SDK 57's root-project Gradle plugin default (`expo-modules-autolinking`'s `ExpoRootProjectPlugin.kt`), no version-catalog override. Whether `35` still clears Play's new-app floor needs a direct check against Play Console at submission time, not this document — Play's targetSdkVersion floor advances roughly yearly and this plan can't stay current with that on its own. Confirm `versionCode` has advanced past every prior upload — CI auto-bumps it on merge (D44), not on your publish schedule.
18. **Decide on R8/minification.** `enableMinifyInReleaseBuilds` is `false` and release lint is disabled (`checkReleaseBuilds false`) — both defensible for an internal APK, both worth revisiting for a public app. If enabled, it needs its own on-device pass; RN/Hermes minification failures are runtime, not build-time.

### Track D — Store listing and the 14-day clock

19. **Register the Play developer account** ($25, personal per D75) and complete identity verification — start this on day one; verification alone can take days.
20. **Create the app** with `applicationId` `com.tormozz48dev.techtok` (permanent, confirmed by D75b) and **enable Play App Signing**.
21. **⚠️ The SHA-1 ordering trap (D68's named failure mode).** Play App Signing rewrites the signing certificate, so the Play-managed SHA-1 **does not exist until the first AAB is uploaded**. The correct order is: upload the first internal-track AAB → read the Play-managed SHA-1 from Play Console (Setup → App signing) → add it to the Android OAuth client → rebuild or re-test. **Google Sign-In will be broken on that very first Play-signed build, by construction.** Expect it; do not debug it.
22. **Store listing:** title, short (80 char) and full (4000 char) descriptions, phone screenshots, a 1024×500 feature graphic, and the 512×512 icon (D66's mascot-in-hexagon mark). Listing copy **is** worth localizing to all four app languages — it is marketing text, not legal text. Category: not News (release-gate item 2); Books & Reference is the natural fit.
23. **Content rating (IARC) and target audience.** Declare app access honestly: the app is behind a sign-in wall, but any Google account works, so reviewers need no special credentials — state that explicitly, since an unexplained login wall is a common rejection cause.
24. **Internal testing track first** (instant, up to 100 testers) to prove the upload, signing, and sign-in chain end to end. Only then promote to the closed track.
25. **Start the closed test:** ≥12 testers opted in, 14 **continuous** days. Log day 1 with a real date. Confirm the 12 accounts exist before starting — a tester dropping out mid-window resets progress.
26. **Apply for production access** after the window closes, then roll out — staged rollout, not 100% on day one.

**Acceptance criteria**

- [ ] `pnpm lint && pnpm typecheck && pnpm test` green; Metro bundle check passes; `apps/site` builds.
- [ ] Phase 19's and phase 20's own acceptance criteria are checked off for real — this phase does not close while they are still "blocked, not deferred".
- [ ] Privacy policy and account-deletion pages are live on the public site and reachable without installing the app; their URLs are recorded in the repo.
- [ ] Data Safety answers in the repo match what the deployed code actually stores, verified field by field against the `Users` item — not against the design doc.
- [ ] A **Play-signed** build from the internal track signs in successfully — the D68 SHA-1 trap confirmed closed, not assumed.
- [ ] A free user can read past D69's nominal 50/10 limits without hitting a paywall (D75d), while `GET /v1/me/entitlement` still reports live counters — enforcement present, limits not biting.
- [ ] The store AAB resolves OTA updates on the channel CI actually publishes to — verified by shipping a JS-only change and watching an installed build pick it up, not by reading config.
- [ ] Closed test running with ≥12 opted-in testers; day 1 logged with a date.
- [ ] Rights review (release-gate item 1) complete at free-launch scope.
- [ ] App live on production with a staged rollout; the install link is on the project site.

**Out of scope:** Play Billing and subscription products (phase 21), extended compact (phase 22), enforcing D69's real limits (phase 21), iOS, and RTDN.

---

## Phase 24 — Relational data layer (Neon Postgres + Drizzle)

**Goal:** all four repos in `packages/core/src/repos/` are backed by a normalized Postgres schema on Neon, reached through Drizzle over the stateless HTTP driver, with **no change to any `packages/shared` contract and no change to any repo method signature** (D90). The DynamoDB tables stay deployed but unread through a soak window, then go.

**Why this is a data-shape phase, not a cost phase.** Measured against live AWS on 2026-08-31: `production` holds ~56 MB total (`Posts` 15,818 rows / 54.8 MB, `UserActivity` 2,117 / 1.1 MB, `Users` 8, `Sources` 11) and `dev` ~36 MB. Storage bills $0 and reads $0.08/mo; the $2.75/mo DynamoDB line D88 found was write amplification, and **D88 already fixed it in place**. So there is no cost argument left for this phase — what it buys is a schema that enforces its own invariants, queries that can filter and join, and a real database in unit tests.

**What D88 changed for this phase, 2026-08-31.** D88 landed on `main` while this plan was being written and it is strictly good news: `queryByTopic` now returns a narrow `PostCandidate` (`postId`, `publishedAt`, `primaryTopic`, `sourceId`, `origTitle`, `status`, `compactLangs?`, `duplicateOf?`), `queryRecent` returns `PostKey[]`, and `buildFeed` gained a `hydrate(postIds)` dep so only the returned page is fetched in full. A feed request therefore moves ~130 KB, not the ~700 KB this plan originally assumed — Neon's 5 GB/month egress allows roughly 38k requests at that shape rather than 7,500. **The candidate/hydrate split must be preserved, not collapsed**, and it happens to map onto SQL exactly: a narrow candidate select plus a hydrate select. Normalization then improves the hydrate half, since one language is joined instead of four.

**Sequencing rule for the whole phase:** every stage from 2 onward leaves the tree green, deployable, and demoable, with a Postgres-backed repo and Dynamo-backed repos coexisting behind one wiring file. No stage requires the next one to land.

### Stage 0 — Maintainer prerequisites (credentialed, outside any AI session)

1. Create **two** Neon projects — `techtok-dev` and `techtok-production` — both in `aws-eu-central-1` to sit beside the Lambdas. Two projects, not two branches of one: the free plan's 0.5 GB storage and 100 CU-hours are per *project*, while branches share their parent's quota.
2. Copy each project's **pooled** connection string (the `-pooler` host), even though stage 1 uses the HTTP driver.
3. `npx sst secret set NeonDatabaseUrl <value> --stage dev`, then again `--stage production`. Same pattern as `OpenRouterApiKey` (D32) — no key is generated, requested, or stored in code. Also add each project's **direct** (non-pooled) connection string as GitHub repository secrets `NEON_DATABASE_URL_DEV_DIRECT`/`NEON_DATABASE_URL_PRODUCTION_DIRECT` (D92) — `Deploy dev`/`Deploy production` run `pnpm db:migrate` against these before every `sst deploy`, so schema migrations reach both stages automatically instead of depending on a maintainer remembering to run `pnpm db:migrate` by hand after every `schema.ts` change.
   **Stage 1 does not have to wait for this.** The repo now vendors Neon's own agent skills (`.claude/skills/neon`, `.claude/skills/neon-postgres`, pinned in `skills-lock.json`), and the `neon` skill documents a Claimable Neon throwaway `DATABASE_URL` that needs no account and can be claimed into a real project later — enough to build the schema and run stage 11's go/no-go spike before any credentialed step happens. Use the skills rather than reasoning about Neon from memory.
4. Confirm the API and pipeline Lambdas are **not** attached to a VPC. They aren't today, and it must stay that way: a VPC would put a NAT gateway between Lambda and Neon and change the cost model from "inside AWS's free 100 GB egress" to a metered per-GB line item.

### Stage 1 — Schema, client, test harness (nothing wired, no behavior change)

5. Dependencies: `drizzle-orm` + `@neondatabase/serverless` in `packages/core`; `drizzle-kit` + `@electric-sql/pglite` as dev deps. No new runtime dependency reaches `packages/shared`, which keeps its "no runtime deps beyond zod" rule intact.
6. `packages/core/src/db/schema.ts` — the fifteen tables and seven enums of D90. Enums are built **from `@techtok/shared`**, not restated: `pgEnum('topic', TOPICS)`, `pgEnum('language', LANGUAGES)`, `pgEnum('transform_kind', transformKindSchema.options)`. That keeps the taxonomy single-source, the same principle as commit 8cfc339, and is the specific reason Drizzle beat Prisma here — a `.prisma` file would be a second place these lists live. Every declaration is a `const`, so the file is entirely group 1 under the file-organization rule.
7. `packages/core/src/db/relations.ts` — Drizzle `relations()` declarations, so the relational query API can hydrate `PostRecord` in one round trip instead of N+1.
8. `drizzle.config.ts` + root scripts `db:generate` and `db:migrate`. Generated SQL migrations are **committed**; `drizzle-kit push` is dev-only and never runs against a deployed stage.
9. `packages/core/src/db/testDb.ts` — a PGlite harness that spins a fresh in-memory Postgres, applies the generated migrations, and returns a Drizzle instance. This replaces `aws-sdk-client-mock` for repo tests and needs no credentials, preserving D34's guarantee that every PR-triggered job runs without AWS.
10. `packages/core/src/clients/sqlClient.ts` — `createSqlClient()` returning `drizzle(neon(requireEnv('DATABASE_URL')), { schema })`. `createDynamoClient` stays until stage 9.
11. **The CTE spike, and the phase's real go/no-go gate.** Before any repo is ported, implement exactly two statements against PGlite: `putIfNew` (insert into `posts` + `post_topics` + `post_translations` as one data-modifying CTE) and `markRead` (upsert `post_snapshots` + upsert `user_reads`, returning `xmax = 0` as `wasNew`). These are the two that decide whether `neon-http`'s non-interactive-transactions-only limit is livable. If they read badly enough to be a maintenance burden, stop and switch to the WebSocket `neon-serverless` driver — and redo stage 0's compute-budget reasoning, because a pooled connection defeats autosuspend.
12. `infra/storage.ts`: `export const neonDatabaseUrl = new sst.Secret('NeonDatabaseUrl')`; link it to every function that currently receives a table name in `infra/api.ts` and `infra/pipeline.ts`. **Deploy-role check (CLAUDE.md's AWS rule): this adds no new AWS resource *kind* and no cross-service grant** — `sst.Secret` is already in use — so no deploying principal needs a broader policy. This is the cheap case; stage 9's table removal is the one to re-check.

### Stage 2 — `SourcesRepo` (proves the seam on 11 rows)

13. Port `SourcesRepo` to Drizzle. `listEnabled`'s `ScanCommand` + `FilterExpression` becomes `where enabled`; `recordFetchResult`'s `ADD failCount :one` becomes `fail_count = sources.fail_count + 1`; `putIfNew` becomes `on conflict do nothing`. `sources` was already 3NF, so nothing reshapes — which is exactly why it goes first.
14. **Seed before switching.** `packages/functions/src/ops/seedSources.ts` writes the 11 presets via `SourcesRepo.putIfNew`. Once the repo reads Postgres, an unseeded database means an ingest run that finds zero sources and silently does nothing. Invoke the seed op against `dev` immediately after deploying, and assert 11 rows before declaring the stage done.
15. Rewrite `sourcesRepo.test.ts` against the PGlite harness.
16. Deploy `dev`, run a real ingest cycle, confirm all 11 rows pick up a fresh `lastFetchAt` — the same check `packages/e2e`'s backend suite already makes.

### Stage 3 — `UsersRepo` (biggest simplification)

17. Port `UsersRepo` across `users` + `user_topics` + `user_muted_sources` + `user_topic_reads` + `user_quotas` + `user_entitlements`. `touch()` becomes one upsert with `returning` plus a relational read of the five child tables — still one round trip on the feed hot path, which is what D48 relied on.
18. **Delete `incrementQuota`'s rollover dance.** The ~45 lines of try-increment → catch `ConditionalCheckFailedException` → write-fresh → catch → retry collapse to one upsert on `(user_id, day)`; a new day is a new row, so there is no rollover branch left to test.
19. **Delete D48's double write.** `addTopicReads` becomes one upsert with `read_count = user_topic_reads.read_count + excluded.read_count`, retiring the "DynamoDB `ADD` can't target nested map paths" workaround its own decision entry documents.
20. `deleteUser` relies on `on delete cascade` across the five child tables. Verify the cascade actually fires in a test — D68's account deletion is a Play requirement, not a nicety.
21. Keep `Quota` and `Entitlement`'s **TypeScript shapes unchanged** even though they are now rows rather than blobs; they reach the client through `GET /v1/me/entitlement`, and the schema snapshot must not move.

### Stage 4 — `UserActivityRepo`

22. Port to `post_snapshots` + `user_reads` + `user_bookmarks`. `markRead` uses stage 11's CTE. `getReadSet`/`getBookmarkSet` become `post_id = any($2)` — one query, deleting the `batchGetChunked` call sites and the 100-key chunk loop.
23. **Keep the pagination cursor an opaque base64 string** so `packages/shared` is untouched, but change its payload from a DynamoDB `LastEvaluatedKey` to `{readAt, postId}` and paginate by keyset on `(read_at desc, post_id desc)`. Old cursors in flight decode to a shape the new reader ignores — treat an unparseable cursor as "start from the top" rather than a 500.
24. **Replace `searchActivity.ts` entirely.** C1's search is currently a client-side loop that pages 100 rows at a time, substring-matches in JS, gives up after 500 scanned rows, and always returns `nextCursor: null`. In Postgres it is `where card_title ilike '%' || $q || '%'` against `post_snapshots`, with real pagination and no scan ceiling. Delete the module and its test; the handler contract does not change.
25. `deleteAllForUser`'s paginated Query + `BatchWrite` loop becomes one `delete` (or nothing at all, given stage 20's cascade — decide deliberately and keep the method for explicitness).

### Stage 5 — `PostsRepo` and the feed pushdown (the egress-critical stage)

26. Port `PostsRepo` across `posts` + `post_topics` + `post_translations` + `post_compacts` + `post_figures`. `updateTransform` now writes the `en` row of `post_translations` alongside the `posts` update; `writeTranslation` upserts any language through the same path; `appendCompactLang` is `insert … on conflict do nothing`; `setMirroredFigures` replaces rows **preserving `position`**, because `compactBlockSchema`'s image blocks address figures by `figureIndex` and an unordered rewrite silently corrupts already-generated compact articles.
27. **Delete `incrementDupCount`.** `dupCount` becomes `count(*) where duplicate_of = $1` over `posts_dup_idx`, so B4's "covered by N sources" badge can no longer drift from reality. If the count shows up in query plans, re-materializing the column is the first fallback.
28. **Preserve D88's candidate/hydrate split, then push the filters down.** `queryByTopic` keeps returning `PostCandidate[]` and `hydrate` keeps returning `PostRecord[]` — do not collapse them into one joined query just because SQL makes it possible. On top of that, move the `status`, `duplicateOf`, `mutedSourceIds` and `compactLangs` filters that `buildFeed` still applies client-side into the candidate query, where `posts_feed_idx` serves them; `buildFeed` keeps merging, ranking and read-exclusion. Its tests change accordingly.
29. **Hydrate one language, not four.** With `post_translations` split out, the hydrate select joins the requested language only and never touches `excerpt`, `s3RawKey` or figures. Tasks 28 and 29 together take a feed request from D88's ~130 KB to ~48 KB — from roughly 38,000 requests per month against Neon's 5 GB allowance to about 110,000. **They must land in the same PR as the port**, because the port alone does not preserve D88's win automatically: a naive relational query that hydrates every candidate would regress the wire cost past where it was before D88.
30. Tighten `findDuplicateOf`'s `queryRecentByTopic` to select only the five fields `DuplicateCandidate` needs, with the 48-hour window pushed into the `where` clause instead of filtered in JS.
31. Fix the equal-timestamp pagination bug while the query is open. D85 records `arxiv-ai` stamping up to 707 posts with one identical `publishedAt`; today's `publishedAt < :before` cursor has no tiebreaker and can skip or repeat inside such a burst. Keyset on `(published_at, post_id)` fixes it. The API cursor stays a string, so this is additive — but reject the old bare-timestamp format gracefully.

### Stage 6 — Expiry sweep (replaces DynamoDB TTL)

32. `delete from posts where expires_at < now()` at the end of the existing hourly ingest handler, cascading to the four child tables via `on delete cascade`. Prune `user_quotas` older than ~35 days in the same sweep.
33. **Do not add an EventBridge schedule for this.** CLAUDE.md's standing gotcha: any `aws.scheduler.Schedule` property change re-validates `iam:PassRole` on the deploying principal and has already broken a `dev` deploy once on nothing more than a rate change. Piggybacking on the existing ingest handler adds no schedule, no resource, no IAM surface.
34. Measure the delete's duration on `dev` at real volume (~700 posts/day × five tables) before trusting it inside a Lambda with the ingest timeout.

### Stage 7 — Data migration

35. **Pre-flight constraint audit, before writing any migration code.** Query both live stages for rows that would violate the new schema: `Posts` rows missing `i18n`, `compactLangs`, `topics`, or `primaryTopic`; `topics`/`lang` values outside `TOPICS`/`LANGUAGES`; `sourceId` values with no `Sources` row; `UserActivity` rows whose `snapshot` lacks a field now `not null`. Print exact counts per violation and decide skip-vs-backfill per class **before** the first `insert`. This is the specific failure CLAUDE.md's Schema & Data Migrations rule exists to prevent — D31's `TransformKind` narrowing shipped without it and 500'd `GET /v1/feed` on 1,740 stale `dev` rows — and this repo is known to carry pre-Phase-8 `Posts` rows with no `i18n` attribute at all.
36. `scripts/migrateToNeon.ts` — `--stage <stage>`, dry-run by default, `--confirm` to write, reusing the `ResourceGroupsTaggingAPI` tag-based table discovery already proven in `scripts/wipeUsers.ts` and `packages/e2e/src/awsDiscovery.ts` rather than hardcoding physical names.
37. The script **reshapes**, it does not copy: 15,818 posts fan out to ~15,818 `posts` + up to ~63,000 `post_translations` + ~35,000 `post_topics` + `post_compacts` + ordered `post_figures`; 2,117 `UserActivity` items split into `post_snapshots` + `user_reads` + `user_bookmarks`; 8 users expand across six tables. Make every insert `on conflict do nothing` so a partial run is resumable.
38. Follow CLAUDE.md's Destructive Operations rule even though this only writes: export every source table to the scratchpad first, print exact per-table counts, and take **one** explicit confirmation. Finish with row-count parity assertions per table and a non-zero exit on mismatch.
39. Unit-test the reshaping against PGlite with fixtures drawn from the real item shapes, including the degenerate ones stage 35 finds.
40. **Migrate `Posts`, do not re-ingest it.** Those 15,818 rows each represent one card transform plus three translations plus four eager compacts of LLM spend (D31/D36). Re-deriving them would be the single most expensive action in this project's history and is precisely what D74's unit-economics framing exists to prevent.

### Stage 8 — Cutover and soak

41. Deploy `dev` — `Deploy dev` now runs `pnpm db:migrate` automatically before `sst deploy` (D92), so this no longer needs a separate manual migration step — then run `packages/e2e`'s full suite against it.
42. Deploy `production` through CI during a quiet window — same automatic `pnpm db:migrate` step (D92) — and verify with the same read-path checks the E2E API suite makes.
43. Soak two weeks. Watch, specifically: Neon storage as a percentage of 0.5 GB, CU-hours against 100/month, egress against 5 GB, and p95 query latency versus the DynamoDB baseline. **Hitting any free-plan limit suspends compute until the next billing cycle** — that is a hard outage, not a degrade, so alert well below each ceiling. Note that D89 deleted the ops dashboard, so **there is no CloudWatch surface to add these to**: the ceilings are read in Neon's own console (or via its API), and re-adding a dashboard costs a flat $3/mo against a 3-per-account free tier — D89's own reasoning applies unchanged, so decide deliberately rather than reflexively.
44. **Understand the rollback window.** A revert is one PR revert plus the still-present DynamoDB tables, but it loses everything written to Postgres after cutover. At 8 users and hourly-regenerating posts that is a few hours of reads and bookmarks — acceptable, and the reason no dual-write layer is being built. Say this out loud before cutting over rather than discovering it during an incident.

### Stage 9 — Decommission (separate PR, after the soak)

45. Delete `clients/dynamoClient.ts`, `batchGetChunked`, `DYNAMO_BATCH_GET_LIMIT`, the `@aws-sdk/lib-dynamodb` / `@aws-sdk/client-dynamodb` dependencies and the `aws-sdk-client-mock` dev dependency. Remove the four `sst.aws.Dynamo` components from `infra/storage.ts`. **Re-run the deploy-role check here** — removing resources is the case CLAUDE.md's AWS rule flags, unlike stage 12's secret.
46. Rewrite `packages/e2e`'s DynamoDB assertions (`src/backendPipeline.test.ts`, `src/awsDiscovery.ts`) against Postgres. This has a **credential consequence that only the maintainer can action**: the `techtok-gha-e2e` role's `dynamodb:Scan`/`Query`/`GetItem` grants become dead, and the suite instead needs the Neon connection string as a GitHub secret. Claude cannot modify IAM policies — flag the narrowing rather than assuming CI keeps working.
47. `infra/monitoring.ts` needs **nothing** — D89 already deleted the ops dashboard along with its two DynamoDB widgets, and none of the seven surviving alarms is DynamoDB-scoped. Confirm that is still true when the stage runs rather than assuming it, then move on.
48. Delete the two orphaned production tables found on 2026-08-31 — `techtok-production-CountersTable` (15 items) and `techtok-production-ContentJobsTable` (0 items) — which D31 and D36 both record as removed but which still exist in AWS.
49. Update `README.md` in the same PR per CLAUDE.md's standing rule: `infra/` resources, required secrets, and the test-tooling description all change here.
50. Update DESIGN §6 to describe the Postgres model, leaving the DynamoDB design in the D90 log entry as superseded history rather than deleting it.

**Acceptance criteria**

- [ ] `pnpm lint && pnpm typecheck && pnpm test` green at the end of **every** stage, not just the last.
- [ ] The schema snapshot (`packages/shared/schema-snapshot.json`) is **byte-identical** to its pre-phase state — the whole phase is invisible to the mobile client, and any diff here means a contract leaked.
- [ ] `putIfNew` and `markRead` pass against PGlite as single statements before any repo is ported (stage 11's go/no-go gate), or the driver decision is revisited on the record.
- [ ] Every repo test runs against PGlite with no AWS credentials present; `aws-sdk-client-mock` is gone from `packages/core`.
- [ ] The pre-flight constraint audit (stage 35) has been run against **both** live stages and its counts recorded, before the migration script writes anything.
- [ ] Post-migration row-count parity is asserted per table on both stages, and the script exits non-zero on mismatch.
- [ ] A real feed request on `dev` transfers ≲60 KB from Neon, measured — not assumed — confirming tasks 28–29 landed and that D88's candidate/hydrate split survived the port.
- [ ] A post older than 90 days is deleted by the ingest sweep on `dev`, and its `post_translations`/`post_topics`/`post_compacts`/`post_figures` rows go with it.
- [ ] History and Saved search returns results a substring match would find beyond the old 500-row scan ceiling, with a working next page.
- [ ] Account deletion removes the user and every child row across all six user-scoped tables, verified by query rather than by reading the cascade declaration.
- [ ] Two weeks of `production` soak with storage, CU-hours and egress each recorded against their ceilings.
- [ ] `packages/e2e` passes against a Postgres-backed `dev`, and the `techtok-gha-e2e` role's dead DynamoDB grants are flagged to the maintainer.

**Out of scope:** S3 (raw archives, images, compact-article JSON on the CDN) and SQS are untouched. No single-table-to-relational change reaches the mobile app, `packages/shared`, or any HTTP contract. Normalizing `post_translations` further (per-field translation provenance), full-text search via `tsvector`, and read replicas are all deliberately deferred — `ilike` is the right size for 2,117 activity rows.

**Effort:** ~9 focused days across stages 0–7, plus a 2-week soak before stage 9. Stage 5 is roughly a quarter of it and carries the egress risk; stage 7 is the one that touches real user data.

---

## Sequencing notes & standing risks

- Phases 0→3 are strictly ordered; 4–6 can interleave.
- Extension ordering (Q22/D20–D25): **7 → 8 → 9 → 10.** Phase 7 is independent and lands first (visible wins, zero new LLM spend). Phase 8 precedes 9 because the reader consumes the language preference, serving contract, and translation machinery that 8 builds. Phase 10 needs real usage of 8+9 to review. Phases 7–9 don't block on phase 5's remaining EAS setup or phase 6.
- Second extension (2026-07-24, D26–D31): **11 → 12** — 11 shipped (`react-native-paper` adopted, see CLAUDE.md). Phase 12 touches the reader UI that phase 11's component sweep also touched, so it lands after. Phase 12 depends on phase 8's `TranslateQueue`/translate-consumer machinery and phase 9's content endpoint — it amends both rather than replacing them, and also removes the daily-cap mechanism phases 3/8/9 each built (D31).
- Third extension (2026-07-24, D32): **13**, standalone — it's a pure transport swap behind the existing `LlmProvider` interface, so it has no dependency on 11 or 12 and could in principle land before them; ordered last here only because it was decided last.
- Fourth extension (2026-07-24, D33–D35): **14**, standalone — CI/CD process changes with no dependency on phase 13's provider swap or any other phase's application code; could land independently, in any order, alongside it.
- Fifth extension (2026-07-24, D36): **13 → 15** — the user explicitly asked for this after the OpenRouter swap, and phase 15's own reasoning depends on it: the eager-compact cost multiplier is only an acceptable tradeoff because D32 already moved LLM spend off the AWS Budget alarm and D31 already removed caps. Phase 15 also reuses phase 12's eager-enqueue pattern (D27) as its template and touches the same reader screen phases 9/11/12 built, so it lands after all of those; it has no dependency on phase 14's CI/CD work.
- Sixth extension (2026-07-24, D37): **16**, standalone — a mobile-asset/build-pipeline fix plus a redesign, with no dependency on 13/14/15's backend work. Surfaced by the user actually performing the on-device APK check every prior phase (7, 10, 11, 12) had deferred to "the maintainer's own step" without ever running — a reminder that a phase's own acceptance criteria checkbox staying unchecked is exactly the gap it's meant to flag, not a formality.
- Seventh extension (2026-07-25, D39): **17**, standalone — a new static site with no dependency on any backend/mobile code from phases 0–16 beyond reading already-existing exported constants (topics, sources, app version) at build time. Its only real dependency is `mobile-build`'s GitHub Release step already existing (amended to non-prerelease) — true since D38/phase 14, so it could in principle have landed any time after that; ordered last only because it was decided last.
- Eighth extension (2026-08-03, D60): **18**, standalone — a small, self-contained addition to phase 17's existing site, with no dependency on any other phase. Its only real dependencies are phase 17's site existing at all and D58's changelog-generating step inside `mobile-build.yml`; ordered last only because it was decided last.
- Ninth extension (2026-08-10, D67–D74): **19 → 20 → 21 → 22**, and unlike every prior extension this ordering is a hard dependency chain, not a preference — entitlements need a real identity to hang off, payments need something to grant, and the paid feature needs something to gate it. The one deliberate piece of sequencing freedom is D70's entitlement indirection, which lets **phase 20 ship a fully demoable paywall before any payment code exists**, taking the riskiest integration (Play Billing, untestable outside a real Play track) off the critical path of proving the product works. Running alongside all four is the release gate above (rights review, Play Console, legal surface, and the 12-testers-for-14-days closed test) — maintainer-side work that blocks *shipping* rather than coding, and whose longest item should start the day phase 21 produces a track build. Two standing constraints change permanently in phase 19 and are worth stating once: the **Expo Go loop ends** (native modules for sign-in and billing; D18's committed `android/` is what makes that survivable), and the app **stores personal data for the first time** (email/name), which is what pulls GDPR, the Data Safety form, and account deletion into scope.
- Tenth extension (2026-08-13, D75): **19 → 20 → 23 → 21 → 22**. Phase 23 is numbered last but executes third — the same "ordered last only because it was decided last" convention phases 13, 17 and 18 already use, chosen over renumbering 21/22 because those numbers are already referenced across CLAUDE.md, DESIGN §7.6, §9 and §11. The re-sequence exists because the ninth extension's ordering had the two longest-latency items in the wrong place: Play's 12-testers-for-14-days gate and store review sat *after* Play Billing, the one integration that cannot be tested outside a real Play track. Free-first moves the clock to the front, where it runs against code that already exists, and turns phase 21 into an update to a live listing with a proven signing chain rather than a first upload and a payment integration at once. Two consequences worth stating: phase 23 is the first phase that is **mostly not coding** — its critical path is account verification, review queues and a 14-calendar-day tester window, so "3–4 days of work" and "4–6 weeks elapsed" are both true and should not be conflated; and it is the phase that finally *closes* phases 19 and 20, which are code-complete with zero verified acceptance criteria between them. The one ordering constraint inside phase 23 that cannot be worked around is D68's SHA-1 trap: the Play-managed signing certificate does not exist until the first AAB is uploaded, so Google Sign-In is necessarily broken on that first Play-signed build and is fixed by a Play Console read-back, not by code.
- Eleventh extension (2026-08-31, D90): **24**, standalone with respect to the product roadmap but **not** orderable against phases 19–23 casually. It touches every repo phases 0–20 built and rewrites the storage half of `packages/e2e`, so it should not run concurrently with phase 23's deploy-and-verify track — two simultaneous "prove the deployed stage works" efforts against the same `dev` stage will confuse each other's failures. The natural slot is **after phase 23 closes and before phase 21**: the free launch needs 19–20 verified against a datastore that is not being replaced underneath it, and phase 21's Play Billing work writes new entitlement rows that would otherwise need migrating twice. The phase is internally ordered as a hard chain only at its edges — stage 1 must precede every port, and stage 9 must follow the soak — while stages 2→5 are independent of each other and could be reordered or parallelized; they are listed smallest-blast-radius-first so the seam is proven on 11 rows before it is trusted with 15,818. Its one irreversible moment is stage 7's production migration, and its one unrecoverable mistake would be skipping stage 35's pre-flight constraint audit, which is the same audit D31 skipped.
- The riskiest unknowns are front-loaded deliberately: DDB key design proves itself in phase 1 (read-exclusion at query time), pipeline semantics in phase 2 (dedup under concurrency), LLM economics in phase 3 (cap mechanics, later removed by D31) — and in the extension, on-demand economics in phase 8 (caps/quotas before new spend exists, later removed) and the rights guardrails at the start of phase 9 (the kill switch before the feature — this one stays, D31 only removed cost caps, not rights guardrails). Phase 12 repeats the front-load pattern once more: its task 1 is removing the cap mechanism entirely, before any eager-enqueue code is written on top of it. Phase 13 has no analogous risk to front-load — the provider swap is contained entirely behind the pre-existing `LlmProvider` interface, which is precisely why it's low-risk enough to sequence last. Each phase's acceptance criteria exist to force that proof.
- Standing rule from DESIGN §2: content-level failures degrade (excerpt cards; for translations, degrade *is* the English fallback; for compacts, the direct link-out), infra-level failures alarm (DLQ). Any new pipeline code follows the same split.
- Every LLM call goes through one of **four** defined paths — transform, translate (eager as of D27/phase 12), compact (eager as of D36/phase 15), and extended compact (on demand, paid, D72/phase 22) — with no daily cap on the first three as of D31/phase 12. The fourth is the exception to two standing properties at once: it is **request-triggered rather than pipeline-triggered** (so it's the only one a user waits on) and it is **the only one with an enforced ceiling** (D73's per-subscriber fair-use cap). No ad-hoc LLM-provider calls outside those four paths, regardless of which provider (OpenRouter or Bedrock, D32/phase 13) is active.
- After phase 3, re-read DESIGN §12 (deferred defaults) and promote/kill items deliberately rather than by drift; same review after phase 10 and after phase 12 (the first real Cost Explorer read under uncapped spend, D31). Phase 13 shifts that spend off Cost Explorer entirely (D32) — its own equivalent check is against OpenRouter's dashboard, not §12.
