import { countersTable, postsTable, rawArticlesBucket, sourcesTable } from './storage';

// Bedrock inference profile for the transform LLM step (DESIGN §7.4). The
// exact profile ID must be confirmed in the Bedrock console once model
// access is enabled for the account (IMPLEMENTATION_PLAN.md phase 3 task 1) —
// override via the `BEDROCK_MODEL_ID` env var if it differs per stage.
const BEDROCK_MODEL_ID =
  process.env.BEDROCK_MODEL_ID ?? 'eu.anthropic.claude-haiku-4-5-20251001-v1:0';
// Default daily transform cap (DESIGN §7.4/§10) — override via `LLM_DAILY_CAP`.
const LLM_DAILY_CAP = process.env.LLM_DAILY_CAP ?? '120';

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

transformQueue.subscribe(
  {
    handler: 'packages/functions/src/pipeline/transform.handler',
    link: [postsTable, rawArticlesBucket, countersTable],
    environment: {
      POSTS_TABLE_NAME: postsTable.name,
      RAW_ARTICLES_BUCKET_NAME: rawArticlesBucket.name,
      COUNTERS_TABLE_NAME: countersTable.name,
      BEDROCK_MODEL_ID,
      LLM_DAILY_CAP,
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
