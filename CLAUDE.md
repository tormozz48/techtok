# TechTok

TikTok-style swipe feed for tech & science news: Expo/React Native Android app + AWS backend (SST v4, Ion architecture) that ingests RSS, condenses articles into cards with Claude, and tracks per-user read state and topic preferences.

The two documents that govern this repo:

- [docs/DESIGN.md](docs/DESIGN.md) — architecture, API, data model. §2 is the **decision log** (D1–D15), §12 the deferred defaults.
- [docs/IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md) — 7 phases, each gated by acceptance criteria.

Never re-decide something already in the decision log. If a decision must change, update the log entry with the reason (`/log-decision`), then implement.

## Status

Phases 0–17 are code complete (phase 6 doesn't exist yet). Full narrative history/verification detail lives in git history and the DESIGN.md decision log (D1–D39) — this table tracks only current state and what's still outstanding.

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
| 14 | CI/CD hardening (D33–D35, D38, D40–D41) | Done, incl. one real E2E run | Maintainer: add `AWS_DEV_DEPLOY_ROLE_ARN` and `AWS_E2E_ROLE_ARN` GitHub secrets. Mobile versioning is manual again (D41 retired the D40 auto-bump after its first post-merge run hit the predicted push race) — remember to bump `apps/mobile/app.json`'s version by hand on mobile-relevant PRs |
| 15 | Eager compact-article generation (D36) | Done, verified live on `dev` | None — no maintainer step outstanding |
| 16 | Visual identity redesign "Orbit" (D37) | Done, verified via decoded compiled resources | Maintainer: real APK build + on-device check (no Android tooling in this env). Also fixed a D30 sync bug where the committed `android/` project never got the D30 branding via `expo prebuild` |
| 17 | Public project site on GitHub Pages (D39) | Done, verified via `astro build` + browser checks + a decoded QR round-trip | Maintainer: enable GitHub Pages if `actions/configure-pages`'s auto-`enablement` doesn't (Settings → Pages → Source: "GitHub Actions"), then confirm the live URL and a real phone QR scan |

Notable cross-phase gotchas worth remembering: DynamoDB reserved keywords (`language`, `status`, `transform`) must be aliased in `UpdateExpression`s — `aws-sdk-client-mock` won't catch this, only a live call will (bit both phase 2 and phase 8). Schema narrowing needs a pre-flight row count against live stages (see Schema & Data Migrations below) — phase 12/D31 shipped without this and 500'd on 1,740 stale `dev` rows. In `apps/site` (phase 17), Astro's `getStaticPaths()` runs in an isolated scope that can see imports but not a sibling top-level `const` in the same file (compute locale lists from an imported binding, not a local constant, or the build throws a `ReferenceError` at generate time); and `import.meta.env.BASE_URL` has no trailing slash (`/techtok`, not `/techtok/`) — use the `withBase()` helper in `src/lib/locale.ts` rather than a raw `${base}${path}` concatenation.

**Update this table whenever a phase lands.**

## Commands (canonical root scripts)

```
pnpm install
pnpm lint        # Biome — this repo has NO ESLint/Prettier (D7)
pnpm typecheck   # tsc --noEmit across workspaces + sst.config.ts/infra (the latter only after a first `pnpm dev`)
pnpm test        # vitest (shared/core/functions) + jest (mobile)
pnpm dev         # sst dev --stage dev — live Lambda on your personal "dev" stage
pnpm --filter mobile start   # Expo dev server
```

Definition of done for any change: lint + typecheck + tests green, then exercised on the dev stage / a device. Verify by running the commands, not by reading the code.

## Layout (planned)

- `packages/shared` — zod v4 contracts + topic taxonomy; imported by server **and** app; no runtime deps beyond zod
- `packages/core` — all business logic (RSS mapping, URL canonicalization, feed merge, DynamoDB repos, LLM client)
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
- LLM calls go only through the three defined pipeline paths — card transform, translate (eager as of D27), compact-article (eager for all 4 languages as of D36, phase 15). No ad-hoc LLM-provider calls anywhere else (OpenRouter primary / Bedrock dormant fallback per DESIGN §2 D32, phase 13). Daily caps/per-source quotas on these paths were removed for simplicity (DESIGN §2 D31, phase 12) — the $10/mo AWS Budget alarm (D11) is a monitoring-only signal now, not an enforced ceiling, and doesn't see OpenRouter spend at all (D32 — separate bill, no AWS-side visibility). (Reserved concurrency 2 on the transform Lambda remains deferred pending an AWS account quota fix — see DESIGN §2 D16.)
- Feed access follows the key design in DESIGN §6 (primaryTopic GSI, read-markers via BatchGet). No table scans or filter-expression shortcuts on `Posts`.
- Keep React Native code cross-platform (D12): no Android-only APIs without a `Platform` guard.
- Conventional commits: `feat:` / `fix:` / `docs:` / `chore:` / `test:` / `refactor:`. *(Mobile app versioning is manual, not commit-driven — DESIGN §2 D41 retired D35's automated semver bump.)*
- Every request/response shape change to `packages/shared`'s zod schemas gets checked against the committed schema snapshot before merge (DESIGN §2 D34) — a removed field, narrowed/changed type, or removed enum value fails CI unless the snapshot is regenerated deliberately.

## AWS

- Region `eu-central-1`. Stages: personal dev stage, named `dev` (`sst dev` / `sst deploy --stage dev`, formerly the OS-username default `andrey`, briefly `stage` — see D17) and `production` (deployed by CI only — don't `sst deploy --stage production` from a laptop). All resources carry default tags `app: techtok-dev|techtok-production` + `stage: <stage name>` for Cost Explorer grouping (D17).
- Never run `sst remove` (denied in settings.json); it destroys deployed stacks.
- Budget ceiling is **$10/mo** (D11). Anything cost-bearing — schedule rates, LLM volume/caps, log retention, new always-on resources — gets checked against DESIGN §10 first.
- Whenever an `infra/` change adds, removes, or changes the type of an AWS resource (new service, new resource kind, cross-service permission like a new `aws.iam.RolePolicy`/`permissions: [...]` grant), check whether the *deploying* principal — not just the Lambda's own runtime role — already covers it, before merging. This has broken dev deploys before with `AccessDenied` on `sst deploy --stage dev`. The deploying principals are: the personal AWS profile/role used for `pnpm dev`/`sst deploy --stage dev` locally, `AWS_DEV_DEPLOY_ROLE_ARN` (CI `dev` deploy, `.github/workflows/deploy-dev.yml`), `AWS_DEPLOY_ROLE_ARN` (CI `production` deploy), and the narrowly-scoped `techtok-gha-e2e` role behind `AWS_E2E_ROLE_ARN` (read/invoke-only, D34 — never grant it write/deploy permissions). Claude cannot modify IAM policies itself (prohibited system/security-settings change); if a new resource type needs a broader deploy-role policy, flag it explicitly to the maintainer rather than assuming CI will just work.

## CI Monitoring

Watch a CI run with a single blocking call — `gh run watch --exit-status <run-id>` — never a polling loop with repeated output. On failure, fetch only the failing job's log with `gh run view --log-failed` and summarize the error lines. Note: the authenticated `gh` account can't re-run a workflow (read-only, see Git & PR Workflow) — if a rerun is needed, say so and let the maintainer trigger it, don't push an empty commit as a workaround.

## Destructive Operations

For bulk deletes or cleanups against live AWS data (DynamoDB rows, S3 objects, etc.): take a backup first (e.g. export the affected items to a scratchpad file), print the exact count of affected rows, and ask for a single explicit confirmation before executing. Prefer one idempotent script over interactive per-row prompts.

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

- Never narrow or otherwise change a `packages/shared` zod schema (or a DynamoDB item shape) without first counting existing rows in every live stage that would violate the new shape, and writing an explicit migration or cleanup plan for them. (D31's `TransformKind` narrowing shipped without this check and 500'd `GET /v1/feed` on 1,740 pre-existing `dev` rows.)
- Watch for DynamoDB reserved keywords (e.g. `language`, `status`, `name`) in any `UpdateExpression`/`ProjectionExpression` — always alias them via `ExpressionAttributeNames`. `aws-sdk-client-mock` does not catch this; it only surfaces live.

## Claude config in this repo

- `.claude/settings.json` — permission allowlist for the common loop + two PostToolUse hooks on Edit/Write: one auto-formats with Biome (no-ops until Biome is installed in Phase 0), one runs a scoped `typecheck` for the edited file's workspace package and surfaces errors immediately instead of waiting for `/check`.
- `/check` — run all quality gates and fix until green
- `/phase` — report progress against the implementation plan, propose next increment
- `/log-decision` — append a decision to the DESIGN.md decision log
- `/ship` — run `/check`, commit, push, and print a PR compare link (gh pr create is not usable here — read-only account)
