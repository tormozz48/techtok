import {
  contentBucket,
  imagesBucket,
  imagesRouter,
  neonDatabaseUrl,
  rawArticlesBucket,
} from './storage';

export const BEDROCK_MODEL_ID =
  process.env.BEDROCK_MODEL_ID ?? 'eu.anthropic.claude-haiku-4-5-20251001-v1:0';

export const LLM_PROVIDER = process.env.LLM_PROVIDER ?? 'openrouter';
export const OPENROUTER_MODEL_ID =
  process.env.OPENROUTER_MODEL_ID ?? 'google/gemini-3.1-flash-lite';

export const openRouterApiKey = new sst.Secret('OpenRouterApiKey');

const llmEnvironment = {
  BEDROCK_MODEL_ID,
  LLM_PROVIDER,
  OPENROUTER_MODEL_ID,
  OPENROUTER_API_KEY: openRouterApiKey.value,
};

const bedrockInvokePermission = {
  actions: ['bedrock:InvokeModel'],
  resources: ['arn:aws:bedrock:*::foundation-model/*', 'arn:aws:bedrock:*:*:inference-profile/*'],
};

export const seedSourcesFn = new sst.aws.Function('SeedSources', {
  handler: 'packages/functions/src/ops/seedSources.handler',
  link: [neonDatabaseUrl],
  environment: {
    STAGE: $app.stage,
    DATABASE_URL: neonDatabaseUrl.value,
  },
  runtime: 'nodejs22.x',
  timeout: '30 seconds',
});

export const transformDlq = new sst.aws.Queue('TransformDLQ');

export const transformQueue = new sst.aws.Queue('TransformQueue', {
  visibilityTimeout: '90 seconds',
  dlq: { queue: transformDlq.arn, retry: 3 },
});

export const translateDlq = new sst.aws.Queue('TranslateDLQ');

export const translateQueue = new sst.aws.Queue('TranslateQueue', {
  visibilityTimeout: '60 seconds',
  dlq: { queue: translateDlq.arn, retry: 3 },
});

export const contentDlq = new sst.aws.Queue('ContentDLQ');

export const contentQueue = new sst.aws.Queue('ContentQueue', {
  visibilityTimeout: '60 seconds',
  dlq: { queue: contentDlq.arn, retry: 3 },
});

transformQueue.subscribe(
  {
    handler: 'packages/functions/src/pipeline/transform.handler',
    link: [
      rawArticlesBucket,
      imagesBucket,
      translateQueue,
      contentQueue,
      openRouterApiKey,
      neonDatabaseUrl,
    ],
    environment: {
      RAW_ARTICLES_BUCKET_NAME: rawArticlesBucket.name,
      IMAGES_BUCKET_NAME: imagesBucket.name,
      IMAGES_CDN_BASE_URL: imagesRouter.url,
      ...llmEnvironment,
      TRANSLATE_QUEUE_URL: translateQueue.url,
      CONTENT_QUEUE_URL: contentQueue.url,
      DATABASE_URL: neonDatabaseUrl.value,
    },
    permissions: [bedrockInvokePermission],
    runtime: 'nodejs22.x',
    timeout: '60 seconds',
  },
  { batch: { size: 5, partialResponses: true } },
);

translateQueue.subscribe(
  {
    handler: 'packages/functions/src/pipeline/translate.handler',
    link: [openRouterApiKey, neonDatabaseUrl],
    environment: {
      ...llmEnvironment,
      DATABASE_URL: neonDatabaseUrl.value,
    },
    permissions: [bedrockInvokePermission],
    runtime: 'nodejs22.x',
    timeout: '30 seconds',
  },
  {
    batch: { size: 5, partialResponses: true },
    transform: {
      eventSourceMapping: {
        scalingConfig: { maximumConcurrency: 2 },
      },
    },
  },
);

contentQueue.subscribe(
  {
    handler: 'packages/functions/src/pipeline/content.handler',
    link: [rawArticlesBucket, imagesBucket, contentBucket, openRouterApiKey, neonDatabaseUrl],
    environment: {
      RAW_ARTICLES_BUCKET_NAME: rawArticlesBucket.name,
      IMAGES_BUCKET_NAME: imagesBucket.name,
      IMAGES_CDN_BASE_URL: imagesRouter.url,
      CONTENT_BUCKET_NAME: contentBucket.name,
      ...llmEnvironment,
      DATABASE_URL: neonDatabaseUrl.value,
    },
    permissions: [bedrockInvokePermission],
    runtime: 'nodejs22.x',
    timeout: '30 seconds',
  },
  { batch: { size: 5, partialResponses: true } },
);

export const backfillLlmFn = new sst.aws.Function('BackfillLlm', {
  handler: 'packages/functions/src/ops/backfillLlm.handler',
  link: [transformQueue, neonDatabaseUrl],
  environment: {
    TRANSFORM_QUEUE_URL: transformQueue.url,
    DATABASE_URL: neonDatabaseUrl.value,
  },
  runtime: 'nodejs22.x',
  timeout: '60 seconds',
});

export const backfillImagesFn = new sst.aws.Function('BackfillImages', {
  handler: 'packages/functions/src/ops/backfillImages.handler',
  link: [rawArticlesBucket, imagesBucket, neonDatabaseUrl],
  environment: {
    RAW_ARTICLES_BUCKET_NAME: rawArticlesBucket.name,
    IMAGES_BUCKET_NAME: imagesBucket.name,
    IMAGES_CDN_BASE_URL: imagesRouter.url,
    DATABASE_URL: neonDatabaseUrl.value,
  },
  runtime: 'nodejs22.x',
  timeout: '900 seconds',
});

const loadSources = sst.aws.StepFunctions.lambdaInvoke({
  name: 'LoadSources',
  function: {
    handler: 'packages/functions/src/pipeline/loadSources.handler',
    link: [neonDatabaseUrl],
    environment: {
      DATABASE_URL: neonDatabaseUrl.value,
    },
    runtime: 'nodejs22.x',
    timeout: '30 seconds',
  },
  output: '{% $states.result.Payload %}',
});

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
    link: [transformQueue, neonDatabaseUrl],
    environment: {
      TRANSFORM_QUEUE_URL: transformQueue.url,
      DATABASE_URL: neonDatabaseUrl.value,
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
    link: [neonDatabaseUrl],
    environment: { DATABASE_URL: neonDatabaseUrl.value },
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
  scheduleExpression: $app.stage === 'production' ? 'rate(60 minutes)' : 'rate(6 hours)',
  flexibleTimeWindow: { mode: 'OFF' },
  target: {
    arn: ingestPipeline.arn,
    roleArn: ingestSchedulerRole.arn,
  },
});
