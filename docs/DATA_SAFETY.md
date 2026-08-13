# Play Console Data Safety worksheet

Not a public page — this is the maintainer's answer key for Play Console's
**App content → Data safety** questionnaire (phase 23, track B, task 12). The
questionnaire has its own fixed taxonomy of data-type checkboxes and is filled
in by hand in the Play Console UI; nothing reads this file automatically. It
exists so those clicks trace back to specific fields in the code, rather than
being re-derived from memory or from the [privacy policy](../apps/site/src/pages/privacy.astro)'s
prose each time the form needs touching — the two must never drift apart.

**Re-check this file whenever `UserRecord` (`packages/core/src/users.types.ts`)
or `ActivityRecord`/`BookmarkRecord` (`packages/core/src/repos/userActivityRepo.ts`)
gains, loses, or changes the meaning of a field**, and before every Data Safety
resubmission.

## Data types collected and shared

Source of truth: `packages/core/src/users.types.ts` (`UserRecord`) and
`packages/core/src/repos/userActivityRepo.ts` (`ActivityRecord`, `BookmarkRecord`).

| Play category | Specific type | Collected? | Shared? | Purpose (Play's own list) | Optional? |
|---|---|---|---|---|---|
| Personal info | Email address | Yes (`UserRecord.email`) | No | Account management | No — required to sign in |
| Personal info | Name | Yes (`UserRecord.name`) | No | Account management | No — required to sign in |
| Personal info | User IDs | Yes (Google `sub`, stored as `userId`) | No | Account management, app functionality | No |
| App activity | App interactions | Yes (read events → `ActivityRecord`, bookmarks → `BookmarkRecord`, `topicReads`) | No | App functionality (feed ranking, History/Saved screens) | No |
| App info and performance | Crash logs | **No** | — | — | — |
| App info and performance | Diagnostics | **No** | — | — | — |
| App info and performance | Other performance data | **No** | — | — | — |
| Device or other IDs | Device or other IDs | **No** — the pre-D68 anonymous `X-Device-Id` was removed outright, not replaced | — | — | — |
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

Google, AWS, Expo and OpenRouter are **processors acting on TechTok's behalf**
under their own contracts, not third parties TechTok *shares* data with for
independent purposes — the Play Console distinction that matters here is
"service provider" vs. "third party." Concretely:

- **Google** — receives the sign-in request directly from the device (not
  routed through TechTok's servers); TechTok's backend only ever sees the
  resulting verified token.
- **AWS** (`eu-central-1`) — hosting infrastructure. Processor.
- **Expo** — receives app/device version at OTA-update-check time, not
  account data. Processor.
- **OpenRouter** — receives **article text from public RSS feeds only**.
  Never receives a user ID, email, or anything from `UserRecord`/`ActivityRecord`.
  Confirmed by reading the LLM call sites in `packages/core/src/llm/` — no
  request there is ever constructed from a user-scoped value.

So: check **"No"** on "Is data shared with third parties," and list Google,
AWS, Expo, and OpenRouter under "service providers" if Play's form separates
the two (it does, in the detailed flow).

## Security practices section

| Question | Answer | Basis |
|---|---|---|
| Data encrypted in transit? | **Yes** | API Gateway HTTP APIs are TLS-only by construction — no plaintext HTTP listener exists (`infra/api.ts` configures no custom domain, so the endpoint is the default `execute-api` HTTPS-only URL). Google Sign-In and OpenRouter calls are HTTPS by their own SDKs. |
| Can users request data deletion? | **Yes** | In-app: `/account` → Delete account → `DELETE /v1/me` (`UsersRepo.deleteUser` + `UserActivityRepo.deleteAllForUser`, phase 19). Web, for users who've uninstalled: the public [account-deletion page](../apps/site/src/pages/delete-account.astro). |
| Committed to Play Families Policy? | No | App is not directed at children; leave unchecked. |
| Independent security review? | No | Leave unchecked — none has been done. |

## What to say about account deletion specifically

Play's Data Safety flow asks separately whether **all** collected data is
deletable. Answer **yes** — `DELETE /v1/me` removes the entire `Users` item
and every paginated `UserActivity` row for that user (both paths covered by
`aws-sdk-client-mock` tests: pagination + chunked `BatchWriteItem`). Nothing
about a deleted user persists server-side. Article/summary/translation content
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
  question — there is deliberately none of this today (see the privacy
  policy's "What the app does not do" section).
