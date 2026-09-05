# TechTok

TikTok-style swipe feed for tech & science news: Expo/React Native Android app + AWS backend (SST v4, Ion architecture) that ingests RSS, condenses articles into cards with Claude, and tracks per-user read state and topic preferences.

The two documents that govern this repo:

- [docs/DESIGN.md](docs/DESIGN.md) — architecture, API, data model. §2 is the **decision log** (D1–D103), §12 the deferred defaults.
- [docs/IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md) — phases 0–24 (no phase 6), each gated by acceptance criteria.

Never re-decide something already in the decision log. If a decision must change, update the log entry with the reason (`/log-decision`), then implement.

## Status

Phases 0–17 are code complete (phase 6 doesn't exist yet). Full narrative history/verification detail lives in git history and the DESIGN.md decision log (D1–D62) — this table tracks only current state and what's still outstanding.

| Phase | Topic | Status | What's left |
|---|---|---|---|
| 0 | Walking skeleton | Done, verified on device | — |
| 1 | Users & read state | Done, verified on device | — |
| 2 | Real pipeline + CI/CD | Done, verified live; `production` deployed via CI | — |
| 3 | LLM transform (Bedrock) | Done | — |
| 4 | Feed quality & polish (7 items) | Feature-complete | Exit bar is subjective ("feels good for a week") — treat as feature-complete, not closed |
| 5 | Friends rollout | Code complete, not deployed | Maintainer: `eas init`, prod API URL in `eas.json`, EAS build, get ≥2 friends installed. (D29: feedback/digest items later retired) |
| 7 | Images & app shell | Done, verified live on `dev` | Maintainer: APK build + on-device check |
| 8 | Localization (i18n) | Done, verified live on `dev` | Maintainer: on-device Expo Go pass |
| 9 | Compact reader | Done, verified live on `dev` | Maintainer: on-device Expo Go pass |
| 10 | Extension polish & cost truth | 3 codeable items done | Time-gated: Cost Explorer review + 2-week soak, not yet elapsed |
| 11 | UI library adoption (Paper, D26) | Done | Maintainer: on-device Expo Go pass |
| 12 | Eager translation + job-polling reader (D27/D31) | Done, verified live on `dev` | Maintainer: on-device pass + week-later Cost Explorer read |
| 13 | LLM provider swap to OpenRouter (D32) | Code complete | Maintainer: set `OpenRouterApiKey` secret (dev + production), deploy, verify OpenRouter call succeeds, test Bedrock fallback. (D38: default model changed to `google/gemini-3.1-flash-lite`) |
| 14 | CI/CD hardening (D33–D35, D38, D40–D44) | Done, incl. one real E2E run | Maintainer: add `AWS_DEV_DEPLOY_ROLE_ARN` and `AWS_E2E_ROLE_ARN` GitHub secrets. Mobile versioning is automated again: `mobile-build.yml` computes a conventional-commit bump baselined against the last `mobile-v*` tag and pushes it directly to `main` (D44, with `[skip ci]` + rebase-retry), then tags the release (D42) — no more hand-editing `apps/mobile/app.json` on mobile-relevant PRs unless overriding the auto-bump |
| 15 | Eager compact-article generation (D36) | Done, verified live on `dev` | None — no maintainer step outstanding |
| 16 | Visual identity redesign "Orbit" (D37) | Done, verified via decoded compiled resources | Maintainer: real APK build + on-device check (no Android tooling in this env). Also fixed a D30 sync bug where the committed `android/` project never got the D30 branding via `expo prebuild` |
| 17 | Public project site on GitHub Pages (D39) | Done, verified via `astro build` + browser checks + a decoded QR round-trip | Maintainer: Settings → Pages → Custom domain `techtokapp.eu`, then Enforce HTTPS once the certificate issues (D39 as amended by D103 — DNS already points at GitHub), then confirm `https://techtokapp.eu` and a real phone QR scan |

### Daily-use polish, smarter ranking & new capabilities (2026-07-26)

Beyond the 17 numbered phases: a follow-up initiative proposed in response to "look at the application and propose new directions," covering three tracks the maintainer selected — daily-use polish (A), smarter feed ranking (B), new capabilities (C) — implemented as 14 independent, individually-mergeable PRs per the maintainer's explicit instruction.

| Increment | Topic | Status | What's left |
|---|---|---|---|
| A1 | Feed refresh: `staleTime` + `AppState`-driven `focusManager` refetch + manual refresh button | Merged (#52) | — |
| A2 | Open the compact reader from History/Saved rows (previously always opened the external browser) | Merged (#51) | — |
| A3 | Finish light mode: `useThemeColors()` hook, full chrome retheme | Merged (#48) | Maintainer: visual pass in both color schemes on a real device (no simulator/Android tooling in this environment) |
| A4 | i18n + a11y sweep: localized topic-chip labels, localized `timeAgo`, header titles, `accessibilityLabel`s | Merged (#50) | — |
| A5 | Feed correctness fixes: `activeCard` reseed on fresh data, fetch-next-page indicator, retry-on-error | Merged (#49) | — |
| A6 | Serve only `ready` posts in the feed, closing a documented-intent gap (D45) | Merged (#53) | — |
| B1 | Affinity write path: per-user `topicReads` counters, written off the existing feed-touch read | Merged (#55) | — |
| B2 | Affinity scoring blend: recency × source weight × a bounded topic-affinity boost | Merged (#54) | — |
| B3 | Mute a source: `PUT /v1/me/muted-sources`, `GET /v1/sources`, settings UI | Merged (#56) | — |
| B4 | "Covered by N sources" badge, plus a real duplicate-chain bug fix found while building it | Merged (#57) | — |
| C1 | Search over history & bookmarks (`?q=` on the existing list endpoints) | Merged (#58) | — |
| C2 | Reading stats screen (streak, top topics/sources — client-computed from history pages) | Merged (#59), logged as D62 | — |
| C3 | Listen mode: `expo-speech` TTS in the feed action bar and the compact reader | Merged (#61) | Maintainer: on-device voice-availability check for ru/uk/pl |
| C4 | Offline saved articles: wifi-gated content prefetch on bookmark + on Saved-screen load | Merged (#62), logged as D55 — **removed again by D82** (2026-08-21) | — |
| C5 | Feed read-ahead content prefetch, extending C4/D55 from explicit bookmarks to scroll position, + a fix so prefetch actually covers in-body figures, + a 50-entry eviction cap (D61) | Merged, then **removed by D82** (2026-08-21) — only the image read-ahead remains | — |

### Going public and paid (2026-08-10, D67–D75, phases 19–23)

The project's posture changes here: D1's "me + friends" and §1's "Play Store publication" non-goal are both retired. TechTok becomes a **publicly listed Play app with a €2.99/mo · €24.99/yr subscription**.

**Execution order is 19 → 20 → 23 → 21 → 22** (D75, 2026-08-13). Phase 23 is numbered last but runs third: the launch is **free-first**, so the store listing, legal surface and the 14-day tester clock all start against code that already exists, instead of queueing behind unwritten billing code. Phase 23 is also what finally *closes* phases 19 and 20 — both are code-complete with zero verified acceptance criteria between them.

| Phase | Topic | Status | What's left |
|---|---|---|---|
| 19 | Google identity (D68) | Code complete | Maintainer-only, all external/credentialed: (1) create the Google Cloud OAuth consent screen + Web/Android client IDs (`infra/auth.ts`, `apps/mobile/src/state/authStore.ts` document exactly what's needed, including the Play-managed-vs-local-debug SHA-1 trap); (2) set `GOOGLE_OAUTH_WEB_CLIENT_ID` at deploy time and `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` in `apps/mobile/.env` (add both to `.env.example` too — this environment couldn't write to that file); (3) run `pnpm exec tsx scripts/wipeUsers.ts --stage dev` then `--confirm` (and same for `production`) — **not run here**, no AWS credentials in this session; (4) `expo prebuild` + a real device/emulator pass, since Google Sign-In ends the plain Expo Go loop (README's Mobile app section covers the new dev-loop commands); (5) provision the E2E suite's dedicated test Google account and its `GOOGLE_TEST_REFRESH_TOKEN`/`GOOGLE_OAUTH_WEB_CLIENT_SECRET` GitHub secrets (`packages/e2e/src/googleTestAuth.ts` — the authenticated E2E suites skip cleanly, not fail, until these exist) |
| 20 | Entitlements & quota (D69/D70) | Code complete | Maintainer-only, all live/on-device: (1) `pnpm exec sst deploy --stage dev` to actually deploy the new `GET /v1/me/entitlement` route + the quota/entitlement fields on `Users`; (2) `pnpm grant-entitlement -- --stage dev --user-id <userId> --plan plus` against a real account to exercise the paid path (script is written, reuses phase 19's `wipeUsers.ts` table-discovery pattern, unverified against live AWS in this session); (3) a real device/emulator pass — quota exhaustion, the paywall, and both locale/color-scheme combinations were only verified at the unit-test/typecheck level, not visually |
| 21 | Play Billing (D67/D71) | Planned | **Stripe is not usable** — Play policy requires Play Billing for in-app digital subscriptions. Verify-on-app-open via the Play Developer API, no GCP Pub/Sub. Needs `PlayServiceAccountKey` secret |
| 22 | Extended compact, paid (D72/D73) | Planned | ~1,500-word on-demand condensation, the **4th** LLM path, fair-use capped at 100/subscriber/month |
| 23 | Public Play launch, free (D75) — **runs before 21–22** | In progress | Done: legal surface (`apps/site` privacy + account-deletion pages); project domain `techtokapp.eu` registered with a live `privacy@`/`support@`/`noreply@` forwarding mailbox, so `CONTACT_EMAIL` is real (D103 — the site's DNS and `astro.config.ts` point at the domain too; Settings → Pages custom domain is the last click); AAB build config (`eas.json` `production` profile); `.github/workflows/mobile-release.yml` (CI-only production AAB builds — this maintainer builds/deploys only via CI, never locally), now wired automatically into `ci.yml`'s main-branch pipeline and auto-submitting to Play's `internal` track once `PlayServiceAccountKey` exists (D98, pulled forward from phase 21 task 2 — the secret itself is still not set); Play Console developer account registered + KYC passed; EAS-managed signing credentials established for the `production` profile (`npx eas-cli credentials --platform android`, run from `apps/mobile/` — note it must be that directory, not the repo root, or it offers to spin up an unrelated new EAS project instead of finding the real one). Still open: create the app in Play Console + enable Play App Signing; set `PlayServiceAccountKey` so the now-automatic pipeline's first push actually uploads to Internal testing and mints the real Play-managed SHA-1 (D68's ordering trap: sign-in breaks on that very first Play-signed build, by construction); deploy + verify 19/20 for real; bind the `production` OTA channel (`eas update:configure`, D65's amendment); 14-day closed test. ~3–4 d of work, ~4–6 weeks elapsed — the two are not the same number |

**Release gate (parallel, maintainer-side; re-scoped by D75).** *Blocks the free launch:* rights review at free-launch scope (assumption #4/D23/§11, deferred since day one — now due); Play Console account (personal, $25, so **no exemption** from the 12-testers-for-14-continuous-days gate); privacy policy + Data Safety + a **public web** account-deletion URL (the in-app `DELETE /v1/me` alone does not satisfy Play). *Blocks monetization only:* subscription products, terms of service, and the paid-scope half of the rights review. The tester window is the longest-lead item in the project — start it the day phase 23 produces an uploadable AAB.

### Relational data layer (2026-08-31, D90/D93/D94, phase 24)

Done. DynamoDB is replaced by **Neon Postgres + Drizzle** on a normalized 16-table schema; the four repos in `packages/core/src/repos/` keep their class names and method signatures, so `packages/shared`, every handler, `buildFeed` and the mobile app are untouched (the schema snapshot must stay byte-identical). Row-to-domain mapping lives in `packages/core/src/models/` (D93). **D94 (2026-09-02)** then reshaped the schema itself: `integer generated always as identity` `id` primary keys everywhere, `<singular>_id` foreign keys that are all indexed and all carry an explicit referential action, `topics` as a table instead of a pg enum, and `sources` split into stable `sources` + volatile `source_states` — see DESIGN §6 for the table-by-table layout. All existing data was dropped rather than migrated (maintainer's call); migration `0003_integer_keys.sql` drops and recreates everything and runs itself on both stages via D92. Measured 2026-08-31, `production` is ~56 MB total, and D88 already removed the one real DynamoDB cost (write amplification, $2.75/mo), so **this is not a cost migration** — the motive is queryability, self-enforcing invariants, and real-Postgres unit tests via PGlite. The binding new constraint is Neon's **5 GB/month egress**, since every row now crosses the internet; D88's `PostCandidate`/`hydrate` split already cuts a feed request to ~130 KB and **must be preserved by the port**, with the single-language join taking it to ~48 KB. Full plan in [docs/IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md) phase 24; slot it after phase 23 closes and before phase 21.

**Two permanent changes land in phase 19:** the **Expo Go loop ends** (native modules for sign-in and billing; D18's committed `android/` is what makes it survivable), and the app **stores personal data for the first time** (email/name), which pulls GDPR, Data Safety and account deletion into scope.

Three things D94 deliberately did **not** normalize, and must stay that way: `user_muted_sources.source_slug` carries no FK (D49 specifies muting as unvalidated; a stray FK broke it once already), `user_reads.post_id`/`user_bookmarks.post_id` carry no FK (posts expire at 90 days, history must outlive them), and S3/CDN object keys use `contentKey(canonicalUrl)` — the sha-256 the old `postId` held — rather than `posts.id`, because §11's guessable-CDN-URL acceptance depends on the key being unguessable and D72's paid extended compacts share that router.

Notable cross-phase gotchas worth remembering: DynamoDB reserved keywords (`language`, `status`, `transform`) must be aliased in `UpdateExpression`s — `aws-sdk-client-mock` won't catch this, only a live call will (bit both phase 2 and phase 8). Schema narrowing needs a pre-flight row count against live stages (see Schema & Data Migrations below) — phase 12/D31 shipped without this and 500'd on 1,740 stale `dev` rows. In `apps/site` (phase 17), Astro's `getStaticPaths()` runs in an isolated scope that can see imports but not a sibling top-level `const` in the same file (compute locale lists from an imported binding, not a local constant, or the build throws a `ReferenceError` at generate time); and `import.meta.env.BASE_URL` is `/` now that the site sits at the apex of `techtokapp.eu` (D39 as amended by D103) but was `/techtok` with no trailing slash under the old project-Pages path — either way, use the `withBase()` helper in `src/lib/locale.ts` rather than a raw `${base}${path}` concatenation.

**Update this table whenever a phase lands.**

## Commands (canonical root scripts)

```
pnpm install
pnpm lint        # Biome + the no-comments check; this repo has NO ESLint/Prettier (D7)
pnpm lint:comments           # just the no-comments check (optionally: <files...>)
pnpm typecheck   # tsc --noEmit across workspaces + sst.config.ts/infra (the latter only after a first `pnpm dev`)
pnpm test        # vitest (every *.test.ts) + jest-expo (apps/mobile's *.test.tsx render tests)
pnpm dev         # sst dev --stage dev — live Lambda on your personal "dev" stage
pnpm --filter mobile start   # Expo dev server
```

Definition of done for any change: lint + typecheck + tests green, then exercised on the dev stage / a device. Verify by running the commands, not by reading the code.

## Layout (planned)

- `packages/shared` — zod v4 contracts + topic taxonomy; imported by server **and** app; no runtime deps beyond zod
- `packages/core` — all business logic (RSS mapping, URL canonicalization, feed merge, Postgres repos via Drizzle, LLM client)
- `packages/functions` — thin Lambda handlers only: parse input → call core → serialize
- `apps/mobile` — Expo app (expo-router)
- `apps/site` — public project site (Astro, static output), deployed to GitHub Pages
- `infra/` — SST components imported by `sst.config.ts`

## Hard rules

- TypeScript strict, Node 22, pnpm workspaces — never npm/yarn commands.
- Handlers stay thin: if logic can't be unit-tested without AWS, it belongs in `core`, not `functions`.
- Every API request/response shape is a zod schema in `packages/shared`; server parses inputs, app parses responses.
- Tests never call live AWS or Bedrock: `aws-sdk-client-mock` + recorded LLM golden fixtures. CI must run with no AWS credentials. *(Exception, DESIGN §2 D34, amended D38: `.github/workflows/e2e.yml` authenticates via AWS OIDC to exercise the real `dev` stage — triggered by schedule/`workflow_dispatch`, and as a required step of `ci.yml`'s main-branch pipeline (between the dev and production deploys). Never triggered by a PR. Every PR-triggered job stays credential-free.)*
- Pipeline failure split (DESIGN §7.2): content-level failures **degrade** (excerpt card, feed never starves); infra-level failures **throw** → SQS retry → DLQ → alarm. Never invert this.
- LLM calls go only through the **four** defined paths — card transform, translate (eager as of D27), compact-article (eager for all 4 languages as of D36, phase 15), and extended compact (on demand, paid, entitlement-gated, D72/phase 22 — the only request-triggered path, and the only one with an enforced ceiling via D73's fair-use cap). No ad-hoc LLM-provider calls anywhere else (OpenRouter primary / Bedrock dormant fallback per DESIGN §2 D32, phase 13). Daily caps/per-source quotas on these paths were removed for simplicity (DESIGN §2 D31, phase 12) — the $10/mo AWS Budget alarm (D11) is a monitoring-only signal now, not an enforced ceiling, and doesn't see OpenRouter spend at all (D32 — separate bill, no AWS-side visibility). (Reserved concurrency 2 on the transform Lambda remains deferred pending an AWS account quota fix — see DESIGN §2 D16.)
- Feed access follows the key design in DESIGN §6: the `posts_feed_idx` partial index on `(primary_topic_id, published_at desc, id desc)`, D88's narrow-candidate-then-hydrate split, and read-markers via `user_reads`. No sequential scans of `posts` on the feed path.
- Keep React Native code cross-platform (D12): no Android-only APIs without a `Platform` guard.
- Two test runners, split by file extension (D104): `*.test.ts` runs under **Vitest** (root `vitest.config.ts` `test.projects`; the mobile project is `apps/mobile/vitest.config.ts` + `vitest.setup.ts`), `*.test.tsx` under **jest-expo** (`apps/mobile/jest.config.js`, `testMatch` is `.tsx` only). Anything that renders a React Native tree must be `.test.tsx` — `@testing-library/react-native` pulls in Flow-typed `react-native` internals Vite cannot parse. Everything else is `.test.ts`. Mobile Vitest tests import `describe`/`it`/`expect`/`vi` from `vitest` explicitly and get native-module mocks from `apps/mobile/vitest.setup.ts`; `apps/mobile/__mocks__/` serves jest only, and Vitest never auto-applies it.
- Screens in `apps/mobile/src/app/` keep their `StyleSheet.create`/`createStyles(colors)` styles in a sibling `<route>.styles.tsx` file (e.g. `account.tsx` → `account.styles.tsx`), exported and imported back into the screen — never defined inline in the route file. New screens follow this from the start; when editing an existing screen's styles, extract them into the sibling file in the same change.
- Keep `apps/mobile` Storybook in sync with real components/screens: every file in `apps/mobile/src/components/*.tsx` needs a matching `*.stories.tsx` in the same directory, and every route in `apps/mobile/src/app/` needs a page story in `apps/mobile/src/stories/pages/` that imports the real screen via `@/app/<route>` (not a re-implementation). When you add a component/screen, add its story in the same change; when you change a component's props/variants or a screen's states, update its story to match — a PostToolUse hook flags missing coverage on Edit/Write, but it can't catch stale prop shapes, only missing files.
- Keep `README.md` reflecting the application's *current* settings, not its history. Any change that alters something the README states — root/package scripts, workflow names or the CI pipeline chain, required secrets and env vars, `infra/` resources, API routes, plan/quota constants, the budget number, prerequisites, directory layout, or phase status — updates the README in the same change. Verify README claims by reading the source of truth (`package.json`, `.github/workflows/*`, `infra/*`, `packages/shared`), never by trusting the prose already there; the README describes what the code does today, while the *why* and the superseded decisions stay in DESIGN.md's log.
- Conventional commits: `feat:` / `fix:` / `docs:` / `chore:` / `test:` / `refactor:`. *(Mobile app versioning is manual, not commit-driven — DESIGN §2 D41 retired D35's automated semver bump.)*
- Every request/response shape change to `packages/shared`'s zod schemas gets checked against the committed schema snapshot before merge (DESIGN §2 D34) — a removed field, narrowed/changed type, or removed enum value fails CI unless the snapshot is regenerated deliberately.
- Don't export a function solely so a test can import it. If nothing outside the test file calls it, keep it internal (unexported) and either test it through the real exported function that uses it, or drop the export and inline the check. Tests should exercise the exports that other modules actually consume, not test-only surface area.

### No comments in code

**Never write a comment in `.ts`, `.tsx`, `.js`, `.jsx`, `.mjs`, `.cjs`, or `.astro`.** No line comments, no block comments, no JSDoc, no section banners, no `TODO`/`FIXME`, no commented-out code, no file-header preambles, no JSX `{/* … */}`, no CSS `/* … */` inside `.astro` `<style>` blocks. This is absolute — not "keep comments minimal", not "only comment non-obvious things". Zero.

The **only** permitted exceptions are comments a tool actually reads, where deleting the text changes build, lint, or test behaviour: `biome-ignore`, `/// <reference … />`, `@ts-expect-error` / `@ts-ignore` / `@ts-nocheck` / `@ts-check`, `eslint-disable*`, `@jest-environment` / `@vitest-environment`, coverage pragmas (`istanbul`/`c8`/`v8 ignore`), `prettier-ignore`, `@type`/`@typedef` casts in `.js`, `sourceMappingURL`, `webpackIgnore`, and `/* @__PURE__ */`. A `biome-ignore` still needs its real reason string — that reason is the suppression's payload, not prose. Never reach for one of these forms as a loophole to smuggle in an explanation.

Put the information where it belongs instead:

- **The "what"** goes in names. If a block needs a comment to be readable, extract it into a well-named function or named intermediate constant. A comment explaining unclear code is a bug report against that code — fix the code.
- **The "why"** goes in `docs/DESIGN.md`'s decision log (`/log-decision`) and is referenced by decision id in the commit message. Architectural rationale, rejected alternatives, and the cross-phase gotchas this file lists are documentation, never inline text.
- **Non-obvious external behaviour** (an upstream library quirk, a DynamoDB reserved-keyword alias, a platform workaround) goes in the commit message plus a DESIGN.md decision entry, so `git log`/`git blame` still surfaces it at the line.
- **Operational and setup facts** go in `README.md`.
- **Test intent** goes in the `describe`/`it` name, which is already prose and already printed on failure.

Enforcement is mechanical, not advisory: `pnpm lint` runs `scripts/checkNoComments.ts` (a TypeScript-scanner walk, so it can't be fooled by `//` inside a string, template literal, or regex; `.astro` gets a line-based pass since Biome can't parse it), and it gates the CI `lint` job. A PostToolUse hook (`.claude/hooks/no-comments-check.sh`) **blocks** the edit and reports the offending line the moment a comment is written. Run `pnpm lint:comments` to check the whole tree, or pass file paths to check just those. Biome has no rule for this and its GritQL plugins can't match comments at all (they're CST trivia, not nodes) — that's why the check is a script rather than a `biome.json` entry.

Out of scope for the checker today, and therefore still comment-bearing: `.github/workflows/*.yml`, Maestro `.yaml` flows, `.sh` scripts (including the hooks themselves), `android/` native sources, and Markdown. Don't add comments there gratuitously, but they aren't policed.

### File organization

Order top-level declarations in every `packages/*/src/**/*.ts(x)` and `apps/*/src/**/*.ts(x)` file into three groups, top to bottom:

1. **Constants and types** — `const`/`let` whose initializer isn't a function/arrow/class, `interface`, `type`, `enum`. Relative order within this group is free (e.g. keep a tight cluster of regex constants together, un-blank-lined, if that's how they read best).
2. **Exported functions and classes** — top-level `function`/`class` declarations, and `const`s assigned an arrow/function/class expression, that carry an `export` modifier (including `export default`).
3. **Private (non-exported) functions and classes** — the same shapes as group 2, without `export`.

Imports stay untouched at the very top, before group 1. Inside a `class` body, apply the same public-before-private split to its methods. A hook name assigned via a factory call (`export const useFooStore = create(...)`) is a constant (group 1), not a function — it's the value being exported, not a function declaration.

This governs top-level *declaration* order, not everything in a file: `describe`/`it` blocks in `*.test.ts(x)`, Storybook `*.stories.tsx` exports, `infra/*.ts` (SST resources are declared in a dependency-ordered chain, not grouped by kind), and root-level `scripts/*.ts` (procedural CLI entry points) are exempt — none of them fit the constants/types → exported → private model this rule describes.

Enforcement mirrors the no-comments check: `pnpm lint` runs `scripts/checkFileOrganization.ts` (walks each file's top-level statements via the TypeScript compiler API and flags any statement whose group appears after a later group), and a PostToolUse hook (`.claude/hooks/file-organization-check.sh`) **blocks** an Edit/Write to a checked file the moment it violates the order. Run `pnpm lint:organization` to check the whole tree, or pass file paths to check just those.

## AWS

- Region `eu-central-1`. Stages: personal dev stage, named `dev` (`sst dev` / `sst deploy --stage dev`, formerly the OS-username default `andrey`, briefly `stage` — see D17) and `production` (deployed by CI only — don't `sst deploy --stage production` from a laptop). All resources carry default tags `app: techtok-dev|techtok-production` + `stage: <stage name>` for Cost Explorer grouping (D17).
- Never run `sst remove` (denied in settings.json); it destroys deployed stacks.
- Budget ceiling was **$10/mo** (D11) through D66. **As of D74 the governing number is per-subscriber unit economics**, not a flat ceiling: ~€2.54/mo net revenue (after Play's 15%) against ≤€2/mo worst-case marginal LLM cost (bounded by D73's fair-use cap). The AWS Budget alarm is raised to **$25/mo** and narrowed to an infrastructure-drift signal — it has not seen LLM spend since D32. The un-priced cost to keep watching: free users generate no revenue but still pay for 1 card + 3 translations + 4 eager compacts per ingested post (D31/D36). Anything cost-bearing still gets checked against DESIGN §10 first.
- Whenever an `infra/` change adds, removes, or changes the type of an AWS resource (new service, new resource kind, cross-service permission like a new `aws.iam.RolePolicy`/`permissions: [...]` grant) **or modifies any property of an existing resource that re-validates `iam:PassRole` (or an equivalent cross-service permission) on every update, not just on creation** — this includes `aws.scheduler.Schedule` (any property change, e.g. `scheduleExpression`), Lambda event-source/role bindings, ECS services/task defs, and Step Functions targets — check whether the *deploying* principal — not just the Lambda's own runtime role — already covers it, before merging. This has broken dev deploys before with `AccessDenied` on `sst deploy --stage dev` (first on a new resource/grant; later on a plain `scheduleExpression` rate change to the pre-existing `IngestSchedule`, because `UpdateSchedule` re-checks `iam:PassRole` on the target role even when the role itself didn't change). The deploying principals are: the personal AWS profile/role used for `pnpm dev`/`sst deploy --stage dev` locally, `AWS_DEV_DEPLOY_ROLE_ARN` (CI `dev` deploy, `.github/workflows/deploy-dev.yml`), `AWS_DEPLOY_ROLE_ARN` (CI `production` deploy), and the narrowly-scoped `techtok-gha-e2e` role behind `AWS_E2E_ROLE_ARN` (read/invoke-only, D34 — never grant it write/deploy permissions). Claude cannot modify IAM policies itself (prohibited system/security-settings change); if a resource needs a broader deploy-role policy — whether newly added or just updated — flag it explicitly to the maintainer rather than assuming CI will just work.

## CI Monitoring

Watch a CI run with a single blocking call — `gh run watch --exit-status <run-id>` — never a polling loop with repeated output. On failure, fetch only the failing job's log with `gh run view --log-failed` and summarize the error lines. Note: the authenticated `gh` account can't re-run a workflow (read-only, see Git & PR Workflow) — if a rerun is needed, say so and let the maintainer trigger it, don't push an empty commit as a workaround.

## Destructive Operations

For bulk deletes or cleanups against live data (Neon Postgres rows, S3 objects, etc.): take a backup first (e.g. export the affected rows to a scratchpad file), print the exact count of affected rows, and ask for a single explicit confirmation before executing. Prefer one idempotent script over interactive per-row prompts.

## Diagrams & Interactive Intake

- Render architecture/pipeline diagrams as native artifacts or images, not fenced ```mermaid code blocks.
- When gathering design decisions (ADRs, decision-log entries, phase intake), ask questions ONE at a time and wait for the answer — never dump a bulk question list.

## Git & PR Workflow

- The `gh` account authenticated in this environment is a non-collaborator with read-only access to this repo (`viewerPermission: READ`) — `gh pr create` will fail every time. Don't attempt it.
- After a change is ready (quality gates green, commit pushed): push the branch, then print a ready-to-click compare link — `https://github.com/tormozz48/techtok/compare/main...<branch>?expand=1` — plus a suggested PR title and body. Let the maintainer open the PR from that link.
- If repo permissions change (confirm via `gh repo view tormozz48/techtok --json viewerPermission`), this restriction can be dropped.

## Quality Gates

Before every commit: `pnpm lint`, then `pnpm typecheck`, then `pnpm test` — all must exit 0. For any `apps/mobile` change, also run a Metro bundle check (`pnpm --filter mobile exec expo export --platform android`) as a cheap proxy for a real device pass. For any `apps/site` change, also run `pnpm --filter site run build` as the equivalent proxy for a real browser pass. Use `/check` to run this loop and fix failures until green; don't commit on a partial pass.

## Schema & Data Migrations

- Never narrow or otherwise change a `packages/shared` zod schema (or a table's row shape) without first counting existing rows in every live stage that would violate the new shape, and writing an explicit migration or cleanup plan for them. (D31's `TransformKind` narrowing shipped without this check and 500'd `GET /v1/feed` on 1,740 pre-existing `dev` rows.)
- Adding or removing a value in `packages/shared`'s `TOPICS` needs a **hand-written data statement** in the migration — since D94 topics are rows in a `topics` table, not a pg enum, and `drizzle-kit generate` diffs DDL only, so it will produce an empty migration and the new topic will simply not exist. Removing one additionally has to clear the `restrict` references from `posts.primary_topic_id`/`sources.default_topic_id` first.
- The DynamoDB reserved-keyword aliasing gotcha (`language`, `status`, `transform` needing `ExpressionAttributeNames`) is retired along with DynamoDB itself (D90) — see the historical note under Status above. Postgres/Drizzle has its own reserved words (e.g. `user`); Drizzle's schema builder quotes identifiers automatically, so this class of bug hasn't recurred, but a raw `sql` template in a repo method is the one place to double-check quoting by hand.

## Claude config in this repo

- `.claude/settings.json` — permission allowlist for the common loop + four PostToolUse hooks on Edit/Write: one auto-formats with Biome (no-ops until Biome is installed in Phase 0), one runs a scoped `typecheck` for the edited file's workspace package and surfaces errors immediately instead of waiting for `/check`, one (`storybook-sync-check.sh`) flags `apps/mobile` components/screens that lack Storybook coverage — informational only, and it only catches missing files, not stale ones (see Hard rules) — and one (`no-comments-check.sh`) which, unlike the other three, **blocks** the edit when it finds a comment in the just-written file (see Hard rules, No comments in code).
- `.claude/skills/` — vendored agent skills, pinned by content hash in the root `skills-lock.json`: `neon` + `neon-postgres` from `neondatabase/agent-skills`, installed with `npx neon@latest skills -s neon -s neon-postgres -y` (re-run to refresh). Skills are discovered at session start, so a new session is needed after installing one.
- `/check` — run all quality gates and fix until green
- `/phase` — report progress against the implementation plan, propose next increment
- `/log-decision` — append a decision to the DESIGN.md decision log
- `/ship` — run `/check`, commit, push, and print a PR compare link (gh pr create is not usable here — read-only account)

## AWS Agent Toolkit

- Prefer the AWS MCP Server for AWS interactions — it provides sandboxed
  execution, observability, and audit logging. If unavailable, use the
  AWS CLI directly.
- Before starting a task, check whether a relevant AWS skill is available.
  Load the skill with `retrieve_skill` and prefer its guidance over
  general knowledge.
- When uncertain about specific AWS details (API parameters, permissions,
  limits, error codes), verify against documentation rather than guessing.
  State uncertainty explicitly if you cannot confirm.
- When creating infrastructure, prefer infrastructure-as-code (AWS CDK or
  CloudFormation) over direct CLI commands. **This repo is the exception:
  its IaC is SST v4/Ion (`infra/`, `sst.config.ts`), a documented decision
  — do not introduce CDK/CloudFormation here.**
- When working with infrastructure, follow AWS Well-Architected Framework
  principles.
- Do not use em dashes in AWS resource names or descriptions. Use
  hyphens instead.

### Secret Safety

- MUST load the `aws-secrets-manager` skill first for any secret,
  credential, API key, token, or password task. MUST NOT call
  `secretsmanager get-secret-value` or `batch-get-secret-value`, and MUST
  NOT hit the Secrets Manager Agent daemon directly. MUST use
  `{{resolve:secretsmanager:secret-id:SecretString:json-key}}` with
  `asm-exec` so the secret resolves at runtime without entering context.
