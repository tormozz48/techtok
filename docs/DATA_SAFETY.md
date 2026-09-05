# Play Console Data Safety worksheet

Not a public page — this is the maintainer's answer key for Play Console's
**App content → Data safety** questionnaire (phase 23, track B, task 12). The
questionnaire has its own fixed taxonomy of data-type checkboxes and is filled
in by hand in the Play Console UI; nothing reads this file automatically. It
exists so those clicks trace back to specific fields in the code, rather than
being re-derived from memory or from the [privacy policy](../apps/site/src/pages/privacy.astro)'s
prose each time the form needs touching — the two must never drift apart.

**Re-check this file whenever (a) `UserRecord` (`packages/core/src/users.types.ts`)
or `ActivityRecord`/`BookmarkRecord` (`packages/core/src/history.types.ts`)
gains, loses, or changes the meaning of a field, (b) any dependency that transmits
anything off-device is added, removed or reconfigured — crash reporting, analytics,
OTA updates, ads — or (c) a request gains a new query parameter or header**, and
before every Data Safety resubmission. Trigger (b) is written this broadly because
the narrower `UserRecord`-only version of this note failed to catch the Sentry
addition, and this file shipped four wrong rows as a result.

## Data types collected and shared

Source of truth: `packages/core/src/users.types.ts` (`UserRecord`) and
`packages/core/src/history.types.ts` (`ActivityRecord`, `BookmarkRecord`) —
the repos in `packages/core/src/repos/` consume those types, they don't declare
them. The Postgres columns behind both are DESIGN §6's `users`/`user_reads`/
`user_bookmarks` tables.

| Play category | Specific type | Collected? | Shared? | Purpose (Play's own list) | Optional? |
|---|---|---|---|---|---|
| Personal info | Email address | Yes (`UserRecord.email`) | No | Account management | No — required to sign in |
| Personal info | Name | Yes (`UserRecord.name`) | No | Account management | No — required to sign in |
| Personal info | User IDs | Yes (Google `sub`, stored as `userId`) | No | Account management, app functionality | No |
| App activity | App interactions | Yes (read events → `ActivityRecord`, bookmarks → `BookmarkRecord`, `topicReads`), plus first-party product-analytics events via `POST /v1/events` (D76 — `logEvent`, name + props, no third-party SDK) | No | App functionality (feed ranking, History/Saved screens) | No |
| App info and performance | Crash logs | **Yes** — Sentry (`apps/mobile/src/state/sentry.ts`) **and first-party**: `logError` also queues a structured record to TechTok's own `POST /v1/events` route (D76, `apps/mobile/src/state/logStore.ts` → CloudWatch) | No — service provider | App functionality (diagnosing breakages) | No |
| App info and performance | Diagnostics | **Yes** (Sentry device context + 10%-sampled performance traces) | No — service provider | App functionality | No |
| App info and performance | Other performance data | **Yes** (Sentry transaction/span timings) | No — service provider | App functionality | No |
| Device or other IDs | Device or other IDs | **Yes** — `EAS-Client-ID`, a random per-install UUID sent to Expo on every update check (`expo-eas-client`). The pre-D68 anonymous `X-Device-Id` is still gone; this is a different, SDK-generated identifier | No — service provider | App functionality (OTA update delivery) | No |
| Financial info | Any | **No** — no payment code exists yet (D75; lands in phase 21) | — | — | — |
| Location | Any | **No** | — | — | — |
| Web browsing | Any | **No** — `Read original` hands off to the OS/in-app browser; TechTok's own servers never see that request | — | — | — |
| Messages | Any | **No** | — | — | — |
| Photos and videos | Any | **No** — TechTok only ever displays publisher-supplied article images; it never reads photos from the device | — | — | — |

Two fields that don't map to any Play category directly, worth stating in the
form's free-text notes: **IANA timezone** (`UserRecord.timezone`, used only for
local-midnight quota reset — closest fit is "App activity" or omit) and
**muted sources / followed topics** (`UserRecord.mutedSources`, `.topics` —
"App activity", preference data used for personalization).

## "Data is shared with third parties" — answer: No

Google, AWS, Neon, Sentry, Expo and OpenRouter are **processors acting on TechTok's behalf**
under their own contracts, not third parties TechTok *shares* data with for
independent purposes — the Play Console distinction that matters here is
"service provider" vs. "third party." Concretely:

- **Google** — receives the sign-in request directly from the device (not
  routed through TechTok's servers); TechTok's backend only ever sees the
  resulting verified token.
- **AWS** (`eu-central-1`) — compute, file storage and content delivery. Processor.
- **Neon** — the Postgres database holding every user-scoped row (email, name,
  Google `sub`, reading history, bookmarks). Processor. Named here because the
  privacy policy previously credited AWS with the database and never mentioned
  Neon, which was an undisclosed-processor problem under GDPR Art. 13.
- **TechTok's own backend** is not a third party at all, but note it for
  completeness: `POST /v1/events` (D76) receives batched client logs and
  product-analytics events from the app into CloudWatch. First-party
  collection is still *collection* for Data Safety purposes — it is why the
  "App interactions", "Crash logs" and "Diagnostics" rows above would stay
  **Yes** even if Sentry were removed tomorrow.
- **Sentry** (EU ingest) — crash reports, stack traces, device context and
  10%-sampled performance traces. Processor. Screenshot, view-hierarchy and
  session-replay capture are explicitly disabled, and `beforeSend`/`beforeBreadcrumb`
  strip URL query strings (which carry the `?q=` search term) and the client IP,
  so Sentry receives no account data and no user-entered text.
- **Expo** — receives app/device version at OTA-update-check time, not
  account data. Processor.
- **OpenRouter** — receives **article text from public RSS feeds only**.
  Never receives a user ID, email, or anything from `UserRecord`/`ActivityRecord`.
  Confirmed by reading the LLM call sites in `packages/core/src/llm/` — no
  request there is ever constructed from a user-scoped value.

So: check **"No"** on "Is data shared with third parties," and list Google,
AWS, Neon, Sentry, Expo, and OpenRouter under "service providers" if Play's form
separates the two (it does, in the detailed flow).

## Security practices section

| Question | Answer | Basis |
|---|---|---|
| Data encrypted in transit? | **Yes** | API Gateway HTTP APIs are TLS-only by construction — no plaintext HTTP listener exists (`infra/api.ts` configures no custom domain, so the endpoint is the default `execute-api` HTTPS-only URL). Google Sign-In and OpenRouter calls are HTTPS by their own SDKs. |
| Can users request data deletion? | **Yes** | In-app: `/account` → Delete account → `DELETE /v1/me` (`UsersRepo.deleteUser` + `UserActivityRepo.deleteAllForUser`, phase 19). Web, for users who've uninstalled: the public [account-deletion page](../apps/site/src/pages/delete-account.astro). |
| Committed to Play Families Policy? | No | App is not directed at children; leave unchecked. |
| Independent security review? | No | Leave unchecked — none has been done. |

## What to say about account deletion specifically

Play's Data Safety flow asks separately whether **all** collected data is
deletable. Answer **yes** — `DELETE /v1/me` deletes the user's `user_reads` and
`user_bookmarks` rows, then the `users` row itself, whose `on delete cascade`
foreign keys clear the remaining five per-user tables (topics, muted sources,
topic reads, quotas, entitlements). Both repo paths are covered by PGlite tests
against the real schema. Nothing about a deleted user persists server-side. Article/summary/translation content
survives, but per the privacy policy it is not personal data and was never
specific to the deleted user in the first place.

## Recheck triggers

- Phase 21 (Play Billing) adds financial/purchase data — **this table's
  "Financial info: No" row must flip**, and the row's rationale note about
  "no payment code exists yet" stops being true.
- Phase 22 (extended compact) adds a fair-use counter on `UserRecord` — likely
  falls under the existing "App activity" row, but re-read it against
  `entitlement.types.ts`'s `FairUse` shape once it exists.
- Any new third-party SDK (crash reporting, analytics, ads) flips multiple
  "No" rows above to "Yes" and requires re-answering the third-party-sharing
  question. This already happened once: Sentry landed after this file was
  written and none of the affected rows were updated until the pre-launch audit
  caught it.
- Re-widening Sentry's capture surface — `attachScreenshot`, `attachViewHierarchy`,
  `replaysOnErrorSampleRate`, or removing the `beforeSend`/`beforeBreadcrumb`
  scrubbers — puts **Email address** (the account screen renders it) and
  **In-app search history** (the `?q=` parameter) back into Sentry's payload and
  makes both declarable as collected. Keep them off, or update this table.
