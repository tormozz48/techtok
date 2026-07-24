import {
  contentBucket,
  contentJobsTable,
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
export const BEDROCK_MODEL_ID =
  process.env.BEDROCK_MODEL_ID ?? 'eu.anthropic.claude-haiku-4-5-20251001-v1:0';

// One-off seed for the Sources table (DESIGN §2 preset list). Not on any
// schedule/route — invoke manually once per stage:
//   aws lambda invoke --function-name <this fn's name> out.json
export const seedSourcesFn = new sst.aws.Function('SeedSources', {
  handler: 'packages/functions/src/ops/seedSources.handler',
  link: [sourcesTable],
  environment: { SOURCES_TABLE_NAME: sourcesTable.name },
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

transformQueue.subscribe(
  {
    handler: 'packages/functions/src/pipeline/transform.handler',
    link: [postsTable, rawArticlesBucket, imagesBucket, sourcesTable, translateQueue],
    environment: {
      POSTS_TABLE_NAME: postsTable.name,
      RAW_ARTICLES_BUCKET_NAME: rawArticlesBucket.name,
      IMAGES_BUCKET_NAME: imagesBucket.name,
      IMAGES_CDN_BASE_URL: imagesRouter.url,
      SOURCES_TABLE_NAME: sourcesTable.name,
      BEDROCK_MODEL_ID,
      TRANSLATE_QUEUE_URL: translateQueue.url,
    },
    permissions: [
      {
        // Bedrock isn't an SST-linkable resource, so its invoke permission is
        // granted directly. Scoped to InvokeModel only, not full bedrock:*.
        actions: ['bedrock:InvokeModel'],
        resources: [
          'arn:aws:bedrock:*::foundation-model/*',
          'arn:aws:bedrock:*:*:inference-profile/*',
        ],
      },
    ],
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
    link: [postsTable],
    environment: {
      POSTS_TABLE_NAME: postsTable.name,
      BEDROCK_MODEL_ID,
    },
    permissions: [
      {
        actions: ['bedrock:InvokeModel'],
        resources: [
          'arn:aws:bedrock:*::foundation-model/*',
          'arn:aws:bedrock:*:*:inference-profile/*',
        ],
      },
    ],
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

// Job-based compact-article generation (D23/D27): `POST /v1/posts/:id/content`
// (packages/functions/src/api/content.ts) enqueues here instead of doing the
// ~11s generation inline; this consumer does the real work and reports
// staged progress through `ContentJobs`, polled via `GET .../content/status`.
export const contentJobDlq = new sst.aws.Queue('ContentJobDLQ');

export const contentJobQueue = new sst.aws.Queue('ContentJobQueue', {
  visibilityTimeout: '60 seconds',
  dlq: { queue: contentJobDlq.arn, retry: 3 },
});

contentJobQueue.subscribe(
  {
    handler: 'packages/functions/src/pipeline/contentJob.handler',
    link: [
      postsTable,
      sourcesTable,
      rawArticlesBucket,
      imagesBucket,
      contentBucket,
      contentJobsTable,
    ],
    environment: {
      POSTS_TABLE_NAME: postsTable.name,
      SOURCES_TABLE_NAME: sourcesTable.name,
      RAW_ARTICLES_BUCKET_NAME: rawArticlesBucket.name,
      IMAGES_BUCKET_NAME: imagesBucket.name,
      IMAGES_CDN_BASE_URL: imagesRouter.url,
      CONTENT_BUCKET_NAME: contentBucket.name,
      CONTENT_JOBS_TABLE_NAME: contentJobsTable.name,
      BEDROCK_MODEL_ID,
    },
    permissions: [
      {
        actions: ['bedrock:InvokeModel'],
        resources: [
          'arn:aws:bedrock:*::foundation-model/*',
          'arn:aws:bedrock:*:*:inference-profile/*',
        ],
      },
    ],
    runtime: 'nodejs22.x',
    // Same ~11s typical generation window as the old synchronous endpoint
    // (D23) — this consumer does the identical work, just off the request path.
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

new aws.scheduler.Schedule('IngestSchedule', {
  scheduleExpression: 'rate(30 minutes)',
  flexibleTimeWindow: { mode: 'OFF' },
  target: {
    arn: ingestPipeline.arn,
    roleArn: ingestSchedulerRole.arn,
  },
});
