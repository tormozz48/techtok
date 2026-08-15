import {
  contentBucket,
  imagesBucket,
  imagesRouter,
  postsTable,
  rawArticlesBucket,
  sourcesTable,
} from './storage';

// Bedrock inference profile for the transform LLM step (DESIGN §7.4).
// Confirmed ACTIVE via `aws bedrock list-inference-profiles` and a live
// `converse` call (IMPLEMENTATION_PLAN.md phase 3 task 1) — override via the
// `BEDROCK_MODEL_ID` env var if a different profile is ever needed per stage.
// Kept as a dormant, env-switchable fallback as of D32 — not the default
// provider anymore, but still fully wired (IAM grants, env var) below.
export const BEDROCK_MODEL_ID =
  process.env.BEDROCK_MODEL_ID ?? 'eu.anthropic.claude-haiku-4-5-20251001-v1:0';

// LLM provider swap to OpenRouter (D32, phase 13): all three LLM pipeline
// paths call OpenRouter by default, selectable back to Bedrock per stage via
// `LLM_PROVIDER`. Model default switched to Gemini 3.1 Flash Lite (D38) —
// ~75%/70% cheaper than the original Claude Haiku 4.5 default on OpenRouter's
// per-token rate, same tier, larger context window.
export const LLM_PROVIDER = process.env.LLM_PROVIDER ?? 'openrouter';
export const OPENROUTER_MODEL_ID =
  process.env.OPENROUTER_MODEL_ID ?? 'google/gemini-3.1-flash-lite';

// The project's first real secret (D32) — set per-stage by the maintainer:
//   npx sst secret set OpenRouterApiKey <value> --stage <dev|production>
export const openRouterApiKey = new sst.Secret('OpenRouterApiKey');

// Shared by every LLM-calling Lambda (transform/translate/content) below —
// same env vars, same IAM grant, since all three select their provider
// through the one `createConfiguredLlmProvider` factory.
const llmEnvironment = {
  BEDROCK_MODEL_ID,
  LLM_PROVIDER,
  OPENROUTER_MODEL_ID,
  OPENROUTER_API_KEY: openRouterApiKey.value,
};

// Bedrock isn't an SST-linkable resource, so its invoke permission is
// granted directly. Scoped to InvokeModel only, not full bedrock:*.
const bedrockInvokePermission = {
  actions: ['bedrock:InvokeModel'],
  resources: ['arn:aws:bedrock:*::foundation-model/*', 'arn:aws:bedrock:*:*:inference-profile/*'],
};

// One-off seed for the Sources table (DESIGN §2 preset list). Not on any
// schedule/route — invoke manually once per stage:
//   aws lambda invoke --function-name <this fn's name> out.json
export const seedSourcesFn = new sst.aws.Function('SeedSources', {
  handler: 'packages/functions/src/ops/seedSources.handler',
  link: [sourcesTable],
  // `STAGE` decides which presets seed as enabled — non-production stages get
  // a small subset (`sourcePresetsForStage`), since a dev stage was paying the
  // full eager per-post LLM fan-out on production-scale volume for no readers.
  environment: { SOURCES_TABLE_NAME: sourcesTable.name, STAGE: $app.stage },
  runtime: 'nodejs22.x',
  timeout: '30 seconds',
});

export const transformDlq = new sst.aws.Queue('TransformDLQ');

export const transformQueue = new sst.aws.Queue('TransformQueue', {
  visibilityTimeout: '90 seconds',
  dlq: { queue: transformDlq.arn, retry: 3 },
});

// Eager card translation (D21/D27): every post gets a job enqueued here for
// each non-English language right after its own transform completes — the
// transform Lambda (below) is a producer, not just the translate Lambda's
// own consumer.
export const translateDlq = new sst.aws.Queue('TranslateDLQ');

export const translateQueue = new sst.aws.Queue('TranslateQueue', {
  visibilityTimeout: '60 seconds',
  dlq: { queue: translateDlq.arn, retry: 3 },
});

// Eager compact-article generation (D36): every post gets a job enqueued
// here for all 4 languages right after its own transform completes, same
// producer relationship as `translateQueue` above — the content Lambda
// (subscribed further below) is this queue's only consumer.
export const contentDlq = new sst.aws.Queue('ContentDLQ');

export const contentQueue = new sst.aws.Queue('ContentQueue', {
  visibilityTimeout: '60 seconds',
  dlq: { queue: contentDlq.arn, retry: 3 },
});

transformQueue.subscribe(
  {
    handler: 'packages/functions/src/pipeline/transform.handler',
    link: [
      postsTable,
      rawArticlesBucket,
      imagesBucket,
      sourcesTable,
      translateQueue,
      contentQueue,
      openRouterApiKey,
    ],
    environment: {
      POSTS_TABLE_NAME: postsTable.name,
      RAW_ARTICLES_BUCKET_NAME: rawArticlesBucket.name,
      IMAGES_BUCKET_NAME: imagesBucket.name,
      IMAGES_CDN_BASE_URL: imagesRouter.url,
      SOURCES_TABLE_NAME: sourcesTable.name,
      ...llmEnvironment,
      TRANSLATE_QUEUE_URL: translateQueue.url,
      CONTENT_QUEUE_URL: contentQueue.url,
    },
    permissions: [bedrockInvokePermission],
    runtime: 'nodejs22.x',
    // Bumped from 30s (phase 2) to allow for the Bedrock round trip,
    // including one repair-retry, on top of the article fetch.
    timeout: '60 seconds',
    // The LLM rate/cost valve (DESIGN §7.2) is normally `concurrency: {
    // reserved: 2 }` here, but this AWS account's Lambda concurrent-execution
    // quota is stuck at 10 (below AWS's default of 1000), and AWS requires
    // >=10 unreserved executions account-wide — so any reserved concurrency
    // on any function fails deployment. Deferred per DESIGN §2 D16; re-add
    // once the account quota is raised.
  },
  { batch: { size: 5, partialResponses: true } },
);

translateQueue.subscribe(
  {
    handler: 'packages/functions/src/pipeline/translate.handler',
    link: [postsTable, openRouterApiKey],
    environment: {
      POSTS_TABLE_NAME: postsTable.name,
      ...llmEnvironment,
    },
    permissions: [bedrockInvokePermission],
    runtime: 'nodejs22.x',
    timeout: '30 seconds',
  },
  {
    batch: { size: 5, partialResponses: true },
    // This is a per-event-source-mapping concurrency cap (a raw escape hatch
    // onto the underlying aws.lambda.EventSourceMapping's own
    // `scalingConfig.maximumConcurrency`), NOT Lambda reserved concurrency —
    // it does not hit the D16 account-quota wall that blocked
    // TransformQueue's reserved concurrency above.
    transform: {
      eventSourceMapping: {
        scalingConfig: { maximumConcurrency: 2 },
      },
    },
  },
);

// Eager compact-article generation consumer (D36): `contentQueue` (declared
// above, alongside `translateQueue`, so the transform Lambda can enqueue to
// it) is consumed here — one message per language, for every post,
// independent of any reader tap.
contentQueue.subscribe(
  {
    handler: 'packages/functions/src/pipeline/content.handler',
    link: [
      postsTable,
      sourcesTable,
      rawArticlesBucket,
      imagesBucket,
      contentBucket,
      openRouterApiKey,
    ],
    environment: {
      POSTS_TABLE_NAME: postsTable.name,
      SOURCES_TABLE_NAME: sourcesTable.name,
      RAW_ARTICLES_BUCKET_NAME: rawArticlesBucket.name,
      IMAGES_BUCKET_NAME: imagesBucket.name,
      IMAGES_CDN_BASE_URL: imagesRouter.url,
      CONTENT_BUCKET_NAME: contentBucket.name,
      ...llmEnvironment,
    },
    permissions: [bedrockInvokePermission],
    runtime: 'nodejs22.x',
    // Same ~11s typical generation window as the old synchronous endpoint
    // (D23) — this consumer does the identical work, just eagerly at ingest
    // time (D36) instead of behind either a reader tap or a job-poll.
    timeout: '30 seconds',
  },
  { batch: { size: 5, partialResponses: true } },
);

// One-shot backfill (IMPLEMENTATION_PLAN.md phase 3 task 7): re-enqueues
// existing `transform=excerpt` posts through the LLM path. Not wired to any
// schedule/route — invoke manually once per stage:
//   aws lambda invoke --function-name <this fn's name> out.json
export const backfillLlmFn = new sst.aws.Function('BackfillLlm', {
  handler: 'packages/functions/src/ops/backfillLlm.handler',
  link: [postsTable, transformQueue],
  environment: {
    POSTS_TABLE_NAME: postsTable.name,
    TRANSFORM_QUEUE_URL: transformQueue.url,
  },
  runtime: 'nodejs22.x',
  timeout: '60 seconds',
});

// One-shot backfill (IMPLEMENTATION_PLAN.md phase 7 task 3): mines the
// og:image out of already-archived raw HTML for posts that never got an
// image at ingest time — no LLM, no live article refetch, so (unlike
// BackfillLlm) it does the extract/mirror/update work inline rather than
// re-enqueueing. Timeout set to the Lambda maximum since a stage's full
// backlog is processed in one invocation; safe to just re-invoke if it ever
// runs out of time; already-mirrored posts drop out of the next run's
// candidate set. Not wired to any schedule/route — invoke manually once per
// stage:
//   aws lambda invoke --function-name <this fn's name> out.json
export const backfillImagesFn = new sst.aws.Function('BackfillImages', {
  handler: 'packages/functions/src/ops/backfillImages.handler',
  link: [postsTable, rawArticlesBucket, imagesBucket],
  environment: {
    POSTS_TABLE_NAME: postsTable.name,
    RAW_ARTICLES_BUCKET_NAME: rawArticlesBucket.name,
    IMAGES_BUCKET_NAME: imagesBucket.name,
    IMAGES_CDN_BASE_URL: imagesRouter.url,
  },
  runtime: 'nodejs22.x',
  timeout: '900 seconds',
});

const loadSources = sst.aws.StepFunctions.lambdaInvoke({
  name: 'LoadSources',
  function: {
    handler: 'packages/functions/src/pipeline/loadSources.handler',
    link: [sourcesTable],
    environment: { SOURCES_TABLE_NAME: sourcesTable.name },
    runtime: 'nodejs22.x',
    timeout: '30 seconds',
  },
  output: '{% $states.result.Payload %}',
});

// Safety net for genuine infra-level Lambda failures (throttling, OOM) that
// bypass FetchSource's own internal try/catch entirely. Content-level
// failures (a broken feed URL, malformed XML) never reach here — they're
// caught inside `ingestSource` and recorded on the source itself.
// A Catch's default ResultPath replaces the state's input entirely with
// `{Error, Cause}` — reshape it back into an IngestResult so Summarize can
// treat every Map iteration's output uniformly, whether it succeeded or was
// caught here.
const fetchSourceFailed = sst.aws.StepFunctions.pass({
  name: 'FetchSourceFailed',
  output: {
    sourceId: 'unknown',
    seen: 0,
    created: 0,
    errors: ['{% $states.input.Error %}'],
  },
});

const fetchSource = sst.aws.StepFunctions.lambdaInvoke({
  name: 'FetchSource',
  function: {
    handler: 'packages/functions/src/pipeline/fetchSource.handler',
    link: [postsTable, sourcesTable, transformQueue],
    environment: {
      POSTS_TABLE_NAME: postsTable.name,
      SOURCES_TABLE_NAME: sourcesTable.name,
      TRANSFORM_QUEUE_URL: transformQueue.url,
    },
    runtime: 'nodejs22.x',
    timeout: '30 seconds',
  },
  payload: '{% $states.input %}',
  output: '{% $states.result.Payload %}',
})
  .retry({ errors: ['States.ALL'], interval: '1 second', maxAttempts: 3, backoffRate: 2 })
  .catch(fetchSourceFailed, { errors: ['States.ALL'] });

const fetchSources = sst.aws.StepFunctions.map({
  name: 'FetchSources',
  processor: fetchSource,
  items: '{% $states.input %}',
  maxConcurrency: 4,
});

const summarize = sst.aws.StepFunctions.lambdaInvoke({
  name: 'Summarize',
  function: {
    handler: 'packages/functions/src/pipeline/summarize.handler',
    runtime: 'nodejs22.x',
    timeout: '30 seconds',
  },
  payload: '{% $states.input %}',
});

export const ingestPipeline = new sst.aws.StepFunctions('IngestPipeline', {
  definition: loadSources
    .next(fetchSources)
    .next(summarize)
    .next(sst.aws.StepFunctions.succeed({ name: 'Done' })),
});

// EventBridge Scheduler (the same modern mechanism CronV2 uses, D15) — SST
// has no built-in way to schedule a StepFunctions execution, so this is a
// raw provider resource.
const ingestSchedulerRole = new aws.iam.Role('IngestSchedulerRole', {
  assumeRolePolicy: JSON.stringify({
    Version: '2012-10-17',
    Statement: [
      {
        Effect: 'Allow',
        Principal: { Service: 'scheduler.amazonaws.com' },
        Action: 'sts:AssumeRole',
      },
    ],
  }),
});

new aws.iam.RolePolicy('IngestSchedulerPolicy', {
  role: ingestSchedulerRole.id,
  policy: ingestPipeline.arn.apply((arn) =>
    JSON.stringify({
      Version: '2012-10-17',
      Statement: [{ Effect: 'Allow', Action: 'states:StartExecution', Resource: arn }],
    }),
  ),
});

// `dev` runs the identical pipeline (same fan-out into eager translate/
// compact-content jobs) but has no real readers, so it doesn't need
// production's freshness — every run's cost multiplies out across every
// enabled source and every post. A 6-hour rate still exercises the pipeline
// regularly without paying for 24 unread runs a day.
new aws.scheduler.Schedule('IngestSchedule', {
  scheduleExpression: $app.stage === 'production' ? 'rate(60 minutes)' : 'rate(6 hours)',
  flexibleTimeWindow: { mode: 'OFF' },
  target: {
    arn: ingestPipeline.arn,
    roleArn: ingestSchedulerRole.arn,
  },
});
