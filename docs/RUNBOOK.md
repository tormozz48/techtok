# TechTok Ops Runbook

Companion to [DESIGN.md](DESIGN.md) and [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md).
Started as a phase-10 deliverable (extension-era queues/caps only): stuck
`TranslateQueue` DLQ, a compact-generation failure spike, and a cap-tuning
playbook. Phase 6's broader scope — broken source detection, a generic
Bedrock-outage case across all three LLM paths, and a cost-spike triage
flow — hasn't run yet and isn't covered below.

All commands assume `AWS_PROFILE=techtok` and the `dev` stage unless noted;
substitute `--profile` / table names for `production` (CI-deployed only —
never `sst deploy --stage production` from a laptop).

## 1. Stuck TranslateQueue DLQ

**Symptom:** `TranslateDlqDepthAlarm` fires (`ApproximateNumberOfMessagesVisible
> 0` on `TranslateDLQ`, [infra/monitoring.ts](../infra/monitoring.ts)).

**Diagnosis**

1. Peek a message: `aws sqs receive-message --queue-url <TranslateDLQ URL> --max-number-of-messages 1`.
   The body is `{"postId": "...", "lang": "..."}`.
2. Every DLQ arrival is preceded by a real infra-level throw — a
   content-level failure (bad LLM output, over-cap) already degrades inside
   `translateArticle` and never reaches the queue's catch block
   ([packages/functions/src/pipeline/translate.ts](../packages/functions/src/pipeline/translate.ts)).
   Search CloudWatch Logs for the `translate` service, filter on `"translate
   failed for message"`, and match `messageId` to the DLQ message's
   `MessageId` to see the actual thrown error.
3. Common root causes seen so far: Bedrock throttling under burst load, a
   DynamoDB call using an unaliased reserved word (real precedent: `language`
   needed `#language` aliasing — see the Phase 8 note in
   [CLAUDE.md](../CLAUDE.md)), or a `postId` that no longer exists (deleted
   row racing an in-flight job).

**Fix**

- If it's a code bug, fix and deploy (`dev` via `sst deploy --stage dev`;
  `production` via merge to `main`) before redriving — otherwise the same
  messages just fail again.
- Redrive: `aws sqs start-message-move-task --source-arn <TranslateDLQ ARN>`
  (or the console's "Start DLQ redrive" action on the queue). Retry budget
  is 3 receives (`infra/pipeline.ts`'s `dlq: { retry: 3 }`) before a message
  lands back in the DLQ again.

**Verify:** `TranslateDlqDepthAlarm` transitions `ALARM → OK`; re-check the
queue depth is 0 (`ApproximateNumberOfMessagesVisible` metric or
`get-queue-attributes`).

## 2. Compact-generation failure spike

**Why this needs its own diagnosis path:** a content-level compact failure
is *not* an error response — `GET /v1/posts/:id/content` always returns
HTTP 200 with `available: false` (D23's degrade convention, same as D22's
translate fallback). `Api5xxAlarm` never fires for this, so a real spike in
"the reader keeps punting to the browser" is invisible on the alarm
dashboard and only shows up in logs.

**Diagnosis:** CloudWatch Logs Insights on the `content` Lambda's log group,
filtered to `message = "content generation degraded"`
([packages/functions/src/api/content.ts](../packages/functions/src/api/content.ts)).
The `reason` field (set in
[packages/core/src/pipeline/contentArticle.ts](../packages/core/src/pipeline/contentArticle.ts))
tells you which case you're in:

| `reason` prefix | Meaning | Is it a spike? |
|---|---|---|
| `compact reader disabled for this source` | `Sources.compactEnabled=false` | No — kill switch working as intended |
| `over daily compact cap` | `compacts#<date>` counter hit `COMPACT_DAILY_CAP` | No — cap working as intended (expect a burst near the day's cap) |
| `article unavailable: ...` | Fetch failed (bot-blocked, dead link, timeout) | Yes if concentrated on one source — check for a new bot-detection page (the `nature.com` precedent: a ~3KB stub with no extractable text) |
| `extraction failed: ...` / `extraction produced no usable text` | `@extractus` couldn't parse the fetched page | Yes if it appears across sources — likely an extractor regression, not a source problem |
| `llm failed: ...` | Bedrock call or repair-retry exhausted | Yes if it appears broadly — check Bedrock throttling/quota or a golden-fixture regression |

**Fix path:** a source actively blocking the fetch has no code fix — flip
`compactEnabled=false` for that source (see §3) rather than retry-hammering
it. An extraction regression needs a code fix in the shared
`figureExtraction`/`@extractus` path. An LLM spike needs a Bedrock
console check (model access, throttling) before assuming a prompt/schema
regression.

## 3. Cap-tuning playbook

Four independent caps gate every LLM call in the pipeline (CLAUDE.md's hard
rule: no ad-hoc Bedrock calls anywhere else):

| Cap | Env var | Default | Set in |
|---|---|---|---|
| Card transform (global) | `LLM_DAILY_CAP` | 120/day | [infra/pipeline.ts](../infra/pipeline.ts) |
| Card transform (per-source) | `Sources.dailyQuota` | 30/day | per-row, `Sources` table |
| Translation | `TRANSLATION_DAILY_CAP` | 100/day | [infra/pipeline.ts](../infra/pipeline.ts) |
| Compact article | `COMPACT_DAILY_CAP` | 20/day | [infra/api.ts](../infra/api.ts) |

**Check current usage:** read the `Counters` table —
`transforms#<date>`, `translations#<date>`, `compacts#<date>`, and
`transforms#<sourceId>#<date>` per source
(`aws dynamodb get-item --table-name <Counters table> --key '{"counterId":{"S":"transforms#2026-07-23"}}'`).

**Change a global cap:** set the env var in the relevant `infra/*.ts` file,
then `sst deploy --stage dev` to test; merge to `main` for `production`
(CI-only deploy, per the hard rule).

**Change a per-source quota:** one-time manual `update-item` on the
`Sources` table's `dailyQuota` attribute, same pattern already used for the
Hugging Face override:
`aws dynamodb update-item --table-name <Sources table> --key '{"sourceId":{"S":"<id>"}}' --update-expression "SET dailyQuota = :q" --expression-attribute-values '{":q":{"N":"10"}}'`.

**Before loosening any cap:** check Cost Explorer per-tag spend
(`app: techtok-production`) against the §10 model, and record the change and
rationale in the DESIGN.md decision log (`/log-decision`) — cap values are a
budget decision, not just a code tweak.

## Removing a source from compact generation (D23 kill switch)

Set `Sources.compactEnabled=false`:
`aws dynamodb update-item --table-name <Sources table> --key '{"sourceId":{"S":"<id>"}}' --update-expression "SET compactEnabled = :f" --expression-attribute-values '{":f":{"BOOL":false}}'`.

**Verify:** `GET /v1/posts/{postId}/content?lang=en` for a post from that
source returns `available: false, reason: "compact reader disabled for this
source"` instantly (no Bedrock/mirror work in the logs), and the mobile
reader routes straight to the in-app browser instead of showing a reader
screen (Card rewiring, Q17).

## Not yet covered (phase 6)

- Broken-source detection independent of the compact/translate paths
  (`Sources.failCount`/`lastStatus` triage).
- A generic Bedrock-outage case spanning transform + translate + compact
  at once.
- A cost-spike triage flow beyond the cap table above.
