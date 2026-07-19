import { postsTable, rawArticlesBucket, sourcesTable } from './storage';

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
    link: [postsTable, rawArticlesBucket],
    environment: {
      POSTS_TABLE_NAME: postsTable.name,
      RAW_ARTICLES_BUCKET_NAME: rawArticlesBucket.name,
    },
    runtime: 'nodejs22.x',
    timeout: '30 seconds',
    // The LLM rate/cost valve (DESIGN §7.2) — set now even though the
    // expensive stage (Bedrock) doesn't exist until phase 3.
    concurrency: { reserved: 2 },
  },
  { batch: { size: 5, partialResponses: true } },
);

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
const fetchSourceFailed = sst.aws.StepFunctions.pass({ name: 'FetchSourceFailed' });

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
