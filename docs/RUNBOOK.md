# TechTok Ops Runbook

Companion to [DESIGN.md](DESIGN.md) and [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md).
Started as a phase-10 deliverable (extension-era queues/caps only). Updated
for phase 12/13/15's changes to the pipeline it documents: all daily LLM
caps were deleted (D31), the LLM provider switched to OpenRouter with
Bedrock kept as a dormant fallback (D32), and compact-article generation
moved from on-demand to eager, dropping the job-polling API (D36). Phase
6's broader scope — broken-source detection, a generic LLM-provider-outage
case across all three pipeline paths, and a cost-spike triage flow — still
hasn't been built and isn't covered below.

All commands assume `AWS_PROFILE=techtok` and the `dev` stage unless noted;
substitute `--profile` / table names for `production` (CI-deployed only —
never `sst deploy --stage production` from a laptop).

## 1. Stuck queue DLQ (Transform / Translate / Content)

All three pipeline queues follow the same shape: a content-level failure
(bad LLM output, a disabled source, a fetch 404) degrades **inside** the
handler and never reaches the queue's catch block; only a genuine
infra-level throw retries (3 receives, `infra/pipeline.ts`'s `dlq: {
retry: 3 }`) and eventually lands in the DLQ. So a DLQ message always means
a bug or an outage, not routine content noise.

| Queue | DLQ | Alarm |
|---|---|---|
| `TransformQueue` | `TransformDLQ` | `DlqDepthAlarm` (name predates the other two, [infra/monitoring.ts](../infra/monitoring.ts)) |
| `TranslateQueue` | `TranslateDLQ` | `TranslateDlqDepthAlarm` |
| `ContentQueue` | `ContentDLQ` | `ContentDlqDepthAlarm` |

Each live queue additionally has a `<Name>QueueBacklogAlarm` on
`ApproximateAgeOfOldestMessage` (> 60 min held for 10 min) — an earlier
signal than DLQ depth, since it fires while a wedged consumer is still
burning through its 3 receives rather than after.

**Diagnosis**

1. Peek a message: `aws sqs receive-message --queue-url <DLQ URL> --max-number-of-messages 1`.
   The body is `{"postId": "..."}` (TransformQueue) or `{"postId": "...",
   "lang": "..."}` (TranslateQueue/ContentQueue).
2. Search CloudWatch Logs for the relevant handler
   ([packages/functions/src/pipeline/transform.ts](../packages/functions/src/pipeline/transform.ts),
   [translate.ts](../packages/functions/src/pipeline/translate.ts), or
   [content.ts](../packages/functions/src/pipeline/content.ts) — note this
   is a different file from the API's
   [api/content.ts](../packages/functions/src/api/content.ts)), filter on
   `"failed for message"`, and match `messageId` to the DLQ message's
   `MessageId` to see the actual thrown error.
3. Common root causes seen so far: LLM-provider throttling under burst load
   (OpenRouter by default, or Bedrock if `LLM_PROVIDER=bedrock` is set for
   that stage, D32), a DynamoDB call using an unaliased reserved word (real
   precedent: `language` needed `#language` aliasing — see the Phase 8 note
   in [CLAUDE.md](../CLAUDE.md)), or a `postId` that no longer exists
   (deleted row racing an in-flight job).

**Fix**

- If it's a code bug, fix and deploy (`dev` via `sst deploy --stage dev`;
  `production` via merge to `main`) before redriving — otherwise the same
  messages just fail again.
- Redrive: `aws sqs start-message-move-task --source-arn <DLQ ARN>` (or the
  console's "Start DLQ redrive" action on the queue).

**Verify:** the queue's depth alarm transitions `ALARM → OK`. The
`techtok-<stage>` CloudWatch dashboard's alarm strip and "DLQ depth" widget
show all three queues at once.

## 2. Compact-article generation failures

**Generation is eager, not on-demand (D36).** Every post gets a
`ContentQueue` message per language (`en`/`ru`/`uk`/`pl`) enqueued right
after transform, independent of whether the card LLM call itself degraded.
`GET /v1/posts/:id/content?lang=` ([packages/functions/src/api/content.ts](../packages/functions/src/api/content.ts))
is a **plain S3 cache read** — it never calls the LLM and never re-triggers
generation. This means a failed eager job has no user-facing retry path: if
generation for a given post+lang fails, that combination stays
unavailable until someone manually re-enqueues it (see Fix path below).

A content-level failure is *not* an error response — the cache-miss branch
always returns HTTP 200 with `available: false` (D23's degrade convention).
`Api5xxAlarm` never fires for this, so a real spike in failed generations
is invisible on the alarm dashboard and only shows up in logs.

**Diagnosis:** CloudWatch Logs Insights on the `content` pipeline Lambda's
log group ([packages/functions/src/pipeline/content.ts](../packages/functions/src/pipeline/content.ts),
**not** the API handler of the same base name), filtered to
`message = "content generation degraded"`. The `reason` field (from
[packages/core/src/pipeline/contentArticle.ts](../packages/core/src/pipeline/contentArticle.ts))
tells you which case you're in:

| `reason` prefix | Meaning | Is it a spike? |
|---|---|---|
| `compact reader disabled for this source` | `Sources.compactEnabled=false` | No — kill switch working as intended (though as of D36 this case is now rare here: the eager enqueue is already skipped at transform time for a disabled source, so this only fires if the flag flipped *after* the job was queued) |
| `article unavailable: ...` | Fetch failed (bot-blocked, dead link, timeout) | Yes if concentrated on one source — check for a new bot-detection page (the `nature.com` precedent: a ~3KB stub with no extractable text) |
| `extraction failed: ...` / `extraction produced no usable text` | `@extractus` couldn't parse the fetched page | Yes if it appears across sources — likely an extractor regression, not a source problem |
| `llm failed: ...` | The LLM call or repair-retry exhausted | Yes if it appears broadly — check the active provider's console (OpenRouter dashboard by default, or Bedrock if `LLM_PROVIDER=bedrock`) for throttling/outage before assuming a prompt/schema regression |

**Fix path:** a source actively blocking the fetch has no code fix — flip
`compactEnabled=false` for that source (see §3) rather than retry-hammering
it. An extraction regression needs a code fix in the shared
`figureExtraction`/`@extractus` path. An LLM spike needs a provider console
check (model access, throttling, an OpenRouter outage) before assuming a
prompt/schema regression. **To retry a specific post+lang** that failed
(there's no automatic retry and no user-facing regenerate action anymore),
manually re-enqueue it: `aws sqs send-message --queue-url <ContentQueue
URL> --message-body '{"postId":"<id>","lang":"<lang>"}'`.

## 3. Removing a source from compact generation (D23/D36 kill switch)

Set `Sources.compactEnabled=false`:
`aws dynamodb update-item --table-name <Sources table> --key '{"sourceId":{"S":"<id>"}}' --update-expression "SET compactEnabled = :f" --expression-attribute-values '{":f":{"BOOL":false}}'`.

This is checked at two points (D36 added the first; D23 originally added
the second and it stays as a belt-and-suspenders check):

1. **At transform time** ([packages/functions/src/pipeline/transform.ts](../packages/functions/src/pipeline/transform.ts)) —
   a disabled source's posts never get enqueued to `ContentQueue` at all,
   so there's zero Content Lambda invocation to look for.
2. **At content-generation time** (the per-language `ContentQueue`
   consumer) — a defensive re-check in case the flag flips after a post
   was already enqueued.

**Verify:** `GET /v1/posts/{postId}/content?lang=en` for a post from that
source returns `available: false, reason: "compactEnabled is false"`
instantly (this is the API's own cache-miss reason string — distinct from
the pipeline consumer's internal log reason,
`"compact reader disabled for this source"`, in §2's table above); confirm
zero Content Lambda invocations in CloudWatch for any *new* post from that
source (the transform-time check means it's never even queued); and the
mobile reader routes straight to the in-app browser instead of showing a
reader screen (Card rewiring, Q17).

## 4. LLM spend has no cap (D31) — monitoring, not throttling

All four daily caps this runbook used to document (global transform,
per-source transform quota, translation, compact article) were deleted
entirely — the `Counters` table is gone, and every pipeline path always
proceeds with its LLM call. There is nothing left to "tune"; if a
cap/throttle is ever wanted again it needs to be redesigned from scratch,
not restored.

**What's left as a signal:**

- The **$25/mo AWS Budget alarm** (D74, amending D11's $10 ceiling) — an
  infrastructure-drift signal only, not an enforced ceiling, and it fires an
  SNS email at 80%/actual and 100%/forecasted. Check current spend: AWS Cost
  Explorer, grouped by the `app: techtok-dev`/`techtok-production` tag (D17).
- **It does not see OpenRouter spend at all** (D32) — that's a separate
  bill with its own dashboard at openrouter.ai. If AWS spend looks fine but
  something feels expensive, check OpenRouter's usage page directly; the
  two costs are tracked nowhere in the same place.

**If a real cost spike needs triage:** check OpenRouter's per-model usage
first (most likely cause given uncapped eager translation + eager 4-language
compacts, D27/D36), then Cost Explorer for the AWS side (S3/CloudFront/DynamoDB
read-write spikes, Lambda duration). There's no cap to flip off as an
emergency lever anymore — the only immediate mitigation is disabling a
noisy source (`compactEnabled=false`, or removing it from `Sources`
entirely) or rolling back a bad deploy.

## Not yet covered (phase 6)

- Broken-source detection independent of the compact/translate paths
  (`Sources.failCount`/`lastStatus` triage).
- A generic LLM-provider-outage case spanning transform + translate +
  compact at once (OpenRouter primary, Bedrock dormant fallback per D32).
- A cost-spike triage flow beyond §4 above — more load-bearing now than
  when this runbook was first written, since D31 removed the cap-based
  backstop entirely.
- A stage-scoped feed-staleness alarm. `IngestStalledAlarm` catches the
  pipeline not *running*, but "runs fine, produces nothing" would need the
  `NewPostCount` EMF metric, and that metric carries only Powertools'
  default `service` dimension — `dev` and `production` publish to one
  series, so a production alarm would be silenced by dev activity. Needs a
  `stage` dimension in [summarize.ts](../packages/functions/src/pipeline/summarize.ts)
  first; the dashboard's ingest-volume widget is labelled all-stages for the
  same reason.
- Degrade-rate visibility (§2's blind spot): the excerpt-fallback,
  translation-skip, and compact-degrade paths still emit no metrics, so a
  feed rotting to 100% excerpt cards keeps every alarm green.
