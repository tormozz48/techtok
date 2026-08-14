import { api } from './api';
import {
  contentDlq,
  contentQueue,
  ingestPipeline,
  transformDlq,
  transformQueue,
  translateDlq,
  translateQueue,
} from './pipeline';
import { postsTable, sourcesTable, userActivityTable, usersTable } from './storage';

// A queue's CloudWatch `QueueName` dimension is the last ARN segment.
const queueName = (arn: $util.Output<string>) => arn.apply((a) => a.split(':').at(-1) ?? a);

// Alarms that watch a *rate* rather than a hard failure are production-only:
// on `dev` they'd fire every time the stage sits idle between experiments,
// and the resulting email noise is what makes people stop reading alarms.
const isProduction = $app.stage === 'production';

const FIVE_MINUTES_SECONDS = 300;
const ONE_HOUR_SECONDS = 3600;
const FOUR_HOURS_SECONDS = 14400;

// First use of raw provider resources in this repo — SST has no built-in
// Budget/Alarm/SNS component (confirmed against the current component list).
export const alertTopic = new aws.sns.Topic('AlertTopic', {});

new aws.sns.TopicSubscription('AlertEmail', {
  topic: alertTopic.arn,
  protocol: 'email',
  endpoint: 'tormozz48@gmail.com',
});

const transformDlqAlarm = new aws.cloudwatch.MetricAlarm('DlqDepthAlarm', {
  alarmDescription: 'TransformQueue DLQ has messages — a poison message or a failing transform.',
  comparisonOperator: 'GreaterThanThreshold',
  evaluationPeriods: 1,
  metricName: 'ApproximateNumberOfMessagesVisible',
  namespace: 'AWS/SQS',
  period: FIVE_MINUTES_SECONDS,
  statistic: 'Maximum',
  threshold: 0,
  dimensions: { QueueName: queueName(transformDlq.arn) },
  alarmActions: [alertTopic.arn],
  treatMissingData: 'notBreaching',
});

const translateDlqAlarm = new aws.cloudwatch.MetricAlarm('TranslateDlqDepthAlarm', {
  alarmDescription: 'TranslateQueue DLQ has messages — a poison message or a failing translation.',
  comparisonOperator: 'GreaterThanThreshold',
  evaluationPeriods: 1,
  metricName: 'ApproximateNumberOfMessagesVisible',
  namespace: 'AWS/SQS',
  period: FIVE_MINUTES_SECONDS,
  statistic: 'Maximum',
  threshold: 0,
  dimensions: { QueueName: queueName(translateDlq.arn) },
  alarmActions: [alertTopic.arn],
  treatMissingData: 'notBreaching',
});

// Closes the gap RUNBOOK §1 documented: `ContentDLQ` was the one pipeline DLQ
// without an alarm, so a wedged compact-article consumer stayed silent.
const contentDlqAlarm = new aws.cloudwatch.MetricAlarm('ContentDlqDepthAlarm', {
  alarmDescription:
    'ContentQueue DLQ has messages — a poison message or a failing compact-article job.',
  comparisonOperator: 'GreaterThanThreshold',
  evaluationPeriods: 1,
  metricName: 'ApproximateNumberOfMessagesVisible',
  namespace: 'AWS/SQS',
  period: FIVE_MINUTES_SECONDS,
  statistic: 'Maximum',
  threshold: 0,
  dimensions: { QueueName: queueName(contentDlq.arn) },
  alarmActions: [alertTopic.arn],
  treatMissingData: 'notBreaching',
});

// Backlog age on the *live* queues, an earlier signal than DLQ depth: a
// wedged consumer shows up here immediately, whereas the DLQ only fills
// after all 3 receives are exhausted.
//
// Threshold is deliberately one full ingest cycle (60 min, the
// `IngestSchedule` rate) held for 10 minutes, not a tight SLA. A normal
// ingest burst legitimately queues a few hundred messages against a
// concurrency ceiling of 10 (D16) — ContentQueue in particular fans out 4
// languages per post at ~11s each — so anything tighter alarms on healthy
// catch-up work.
const queueBacklogAlarms = (
  [
    ['Transform', transformQueue.arn],
    ['Translate', translateQueue.arn],
    ['Content', contentQueue.arn],
  ] as const
).map(
  ([label, arn]) =>
    new aws.cloudwatch.MetricAlarm(`${label}QueueBacklogAlarm`, {
      alarmDescription: `${label}Queue has a message older than 60 minutes — the consumer is not keeping up or is wedged.`,
      comparisonOperator: 'GreaterThanThreshold',
      evaluationPeriods: 2,
      metricName: 'ApproximateAgeOfOldestMessage',
      namespace: 'AWS/SQS',
      period: FIVE_MINUTES_SECONDS,
      statistic: 'Maximum',
      threshold: ONE_HOUR_SECONDS,
      dimensions: { QueueName: queueName(arn) },
      alarmActions: [alertTopic.arn],
      treatMissingData: 'notBreaching',
    }),
);

const ingestPipelineFailedAlarm = new aws.cloudwatch.MetricAlarm('IngestPipelineFailedAlarm', {
  alarmDescription: 'An IngestPipeline execution failed.',
  comparisonOperator: 'GreaterThanThreshold',
  evaluationPeriods: 1,
  metricName: 'ExecutionsFailed',
  namespace: 'AWS/States',
  period: FIVE_MINUTES_SECONDS,
  statistic: 'Sum',
  threshold: 0,
  dimensions: { StateMachineArn: ingestPipeline.arn },
  alarmActions: [alertTopic.arn],
  treatMissingData: 'notBreaching',
});

const api5xxAlarm = new aws.cloudwatch.MetricAlarm('Api5xxAlarm', {
  alarmDescription: 'The API is returning 5xx errors.',
  comparisonOperator: 'GreaterThanThreshold',
  evaluationPeriods: 1,
  metricName: '5xx',
  namespace: 'AWS/ApiGateway',
  period: FIVE_MINUTES_SECONDS,
  statistic: 'Sum',
  threshold: 0,
  dimensions: { ApiId: api.nodes.api.id },
  alarmActions: [alertTopic.arn],
  treatMissingData: 'notBreaching',
});

// Every alarm above fires on an *error*. Nothing detected the pipeline simply
// stopping — a broken `IngestSchedule`, a revoked scheduler role, a disabled
// state machine — which is the failure the reader actually notices, as a feed
// that quietly goes stale. `treatMissingData: 'breaching'` is the whole point
// here: no data *is* the incident, unlike every other alarm in this file.
const ingestStalledAlarm = isProduction
  ? new aws.cloudwatch.MetricAlarm('IngestStalledAlarm', {
      alarmDescription:
        'No IngestPipeline execution started in 4 hours (schedule is every 60 min) — ingestion has stopped.',
      comparisonOperator: 'LessThanThreshold',
      evaluationPeriods: 1,
      metricName: 'ExecutionsStarted',
      namespace: 'AWS/States',
      period: FOUR_HOURS_SECONDS,
      statistic: 'Sum',
      threshold: 1,
      dimensions: { StateMachineArn: ingestPipeline.arn },
      alarmActions: [alertTopic.arn],
      treatMissingData: 'breaching',
    })
  : undefined;

// Account-wide on purpose, and therefore created once (on `production`)
// rather than per stage: the concurrent-execution quota this guards is stuck
// at 10 for the whole account (D16), so a `dev` burst throttles `production`
// and vice versa — a per-stage alarm would attribute the symptom to the wrong
// stack. Throttling surfaces to readers as feed 5xx, so it needs its own
// signal rather than being inferred from `Api5xxAlarm`.
const lambdaThrottledAlarm = isProduction
  ? new aws.cloudwatch.MetricAlarm('LambdaThrottledAlarm', {
      alarmDescription:
        'Lambda invocations are being throttled account-wide — the concurrency ceiling (10, D16) is being hit.',
      comparisonOperator: 'GreaterThanThreshold',
      evaluationPeriods: 1,
      metricName: 'Throttles',
      namespace: 'AWS/Lambda',
      period: FIVE_MINUTES_SECONDS,
      statistic: 'Sum',
      threshold: 0,
      alarmActions: [alertTopic.arn],
      treatMissingData: 'notBreaching',
    })
  : undefined;

// One dashboard per stage — the CloudWatch free tier covers 3, so `dev` +
// `production` cost nothing. Everything below is built from metrics AWS
// already publishes plus the EMF counters `summarize.ts` emits, so the
// dashboard adds no custom-metric charge either ($0.30/metric/month, and
// only 10 are free — the reason this stays free is that it introduces no new
// metric names at all).
const alarmArns = [
  transformDlqAlarm,
  translateDlqAlarm,
  contentDlqAlarm,
  ...queueBacklogAlarms,
  ingestPipelineFailedAlarm,
  api5xxAlarm,
  ingestStalledAlarm,
  lambdaThrottledAlarm,
]
  .filter((alarm) => alarm !== undefined)
  .map((alarm) => alarm.arn);

const dashboardBody = $resolve({
  alarmArns: $util.all(alarmArns),
  apiId: api.nodes.api.id,
  contentDlqName: queueName(contentDlq.arn),
  contentQueueName: queueName(contentQueue.arn),
  postsTableName: postsTable.name,
  sourcesTableName: sourcesTable.name,
  stateMachineArn: ingestPipeline.arn,
  transformDlqName: queueName(transformDlq.arn),
  transformQueueName: queueName(transformQueue.arn),
  translateDlqName: queueName(translateDlq.arn),
  translateQueueName: queueName(translateQueue.arn),
  userActivityTableName: userActivityTable.name,
  usersTableName: usersTable.name,
}).apply((r) => {
  const liveQueues = [
    ['Transform', r.transformQueueName],
    ['Translate', r.translateQueueName],
    ['Content', r.contentQueueName],
  ] as const;
  const dlqs = [
    ['Transform', r.transformDlqName],
    ['Translate', r.translateDlqName],
    ['Content', r.contentDlqName],
  ] as const;
  const tables = [
    ['Posts', r.postsTableName],
    ['Sources', r.sourcesTableName],
    ['Users', r.usersTableName],
    ['UserActivity', r.userActivityTableName],
  ] as const;

  const sfn = (metricName: string, label: string, stat?: string) => [
    'AWS/States',
    metricName,
    'StateMachineArn',
    r.stateMachineArn,
    stat ? { label, stat } : { label },
  ];
  const sqs = (metricName: string, [label, name]: readonly [string, string]) => [
    'AWS/SQS',
    metricName,
    'QueueName',
    name,
    { label },
  ];
  const ddb = (metricName: string, [label, name]: readonly [string, string], suffix = '') => [
    'AWS/DynamoDB',
    metricName,
    'TableName',
    name,
    { label: `${label}${suffix}` },
  ];
  const apigw = (metricName: string, label: string, stat?: string) => [
    'AWS/ApiGateway',
    metricName,
    'ApiId',
    r.apiId,
    stat ? { label, stat } : { label },
  ];

  return JSON.stringify({
    widgets: [
      {
        type: 'alarm',
        x: 0,
        y: 0,
        width: 24,
        height: 3,
        properties: { title: 'Alarms', alarms: r.alarmArns },
      },

      // Row 1 — is the pipeline running, and is it producing anything?
      {
        type: 'metric',
        x: 0,
        y: 3,
        width: 8,
        height: 6,
        properties: {
          title: 'Ingest runs',
          region: 'eu-central-1',
          view: 'timeSeries',
          period: ONE_HOUR_SECONDS,
          stat: 'Sum',
          metrics: [
            sfn('ExecutionsStarted', 'started'),
            sfn('ExecutionsSucceeded', 'succeeded'),
            sfn('ExecutionsFailed', 'failed'),
            sfn('ExecutionsTimedOut', 'timed out'),
          ],
        },
      },
      {
        type: 'metric',
        x: 8,
        y: 3,
        width: 8,
        height: 6,
        properties: {
          // The EMF metrics `summarize.ts` publishes carry only Powertools'
          // default `service` dimension — no stage dimension — so `dev` and
          // `production` land on the same series here. Adding one is a
          // handler change, not an infra change; until then read this widget
          // as all-stages-combined.
          title: 'Ingest volume (all stages — EMF has no stage dimension)',
          region: 'eu-central-1',
          view: 'timeSeries',
          period: ONE_HOUR_SECONDS,
          stat: 'Sum',
          metrics: [
            ['TechTok', 'IngestedCount', 'service', 'ingest', { label: 'entries seen' }],
            ['TechTok', 'NewPostCount', 'service', 'ingest', { label: 'new posts' }],
            ['TechTok', 'SourceErrorCount', 'service', 'ingest', { label: 'sources erroring' }],
          ],
        },
      },
      {
        type: 'metric',
        x: 16,
        y: 3,
        width: 8,
        height: 6,
        properties: {
          title: 'Ingest run duration',
          region: 'eu-central-1',
          view: 'timeSeries',
          period: ONE_HOUR_SECONDS,
          metrics: [sfn('ExecutionTime', 'avg', 'Average'), sfn('ExecutionTime', 'max', 'Maximum')],
        },
      },

      // Row 2 — queue health. Depth alone is ambiguous (a burst looks like a
      // wedge); depth + age together are not.
      {
        type: 'metric',
        x: 0,
        y: 9,
        width: 8,
        height: 6,
        properties: {
          title: 'Queue depth',
          region: 'eu-central-1',
          view: 'timeSeries',
          period: FIVE_MINUTES_SECONDS,
          stat: 'Maximum',
          metrics: liveQueues.map((q) => sqs('ApproximateNumberOfMessagesVisible', q)),
        },
      },
      {
        type: 'metric',
        x: 8,
        y: 9,
        width: 8,
        height: 6,
        properties: {
          title: 'Oldest message age (s)',
          region: 'eu-central-1',
          view: 'timeSeries',
          period: FIVE_MINUTES_SECONDS,
          stat: 'Maximum',
          metrics: liveQueues.map((q) => sqs('ApproximateAgeOfOldestMessage', q)),
          annotations: {
            horizontal: [{ label: 'backlog alarm (60 min)', value: ONE_HOUR_SECONDS }],
          },
        },
      },
      {
        type: 'metric',
        x: 16,
        y: 9,
        width: 8,
        height: 6,
        properties: {
          title: 'DLQ depth (any message = a bug or an outage)',
          region: 'eu-central-1',
          view: 'timeSeries',
          period: FIVE_MINUTES_SECONDS,
          stat: 'Maximum',
          metrics: dlqs.map((q) => sqs('ApproximateNumberOfMessagesVisible', q)),
        },
      },

      // Row 3 — Lambda, account-wide (see LambdaThrottledAlarm: the quota
      // being watched is an account quota, not a per-stage one).
      {
        type: 'metric',
        x: 0,
        y: 15,
        width: 8,
        height: 6,
        properties: {
          title: 'Lambda invocations & errors (account-wide)',
          region: 'eu-central-1',
          view: 'timeSeries',
          period: FIVE_MINUTES_SECONDS,
          stat: 'Sum',
          metrics: [
            ['AWS/Lambda', 'Invocations', { label: 'invocations' }],
            ['AWS/Lambda', 'Errors', { label: 'errors' }],
          ],
        },
      },
      {
        type: 'metric',
        x: 8,
        y: 15,
        width: 8,
        height: 6,
        properties: {
          title: 'Lambda throttles & concurrency (account-wide)',
          region: 'eu-central-1',
          view: 'timeSeries',
          period: FIVE_MINUTES_SECONDS,
          metrics: [
            ['AWS/Lambda', 'Throttles', { label: 'throttles', stat: 'Sum' }],
            ['AWS/Lambda', 'ConcurrentExecutions', { label: 'concurrent', stat: 'Maximum' }],
          ],
          annotations: {
            horizontal: [{ label: 'account quota (10, D16)', value: 10 }],
          },
        },
      },
      {
        type: 'metric',
        x: 16,
        y: 15,
        width: 8,
        height: 6,
        properties: {
          title: 'Lambda duration p95 (account-wide)',
          region: 'eu-central-1',
          view: 'timeSeries',
          period: FIVE_MINUTES_SECONDS,
          metrics: [['AWS/Lambda', 'Duration', { label: 'p95', stat: 'p95' }]],
        },
      },

      // Row 4 — the API as the app sees it.
      {
        type: 'metric',
        x: 0,
        y: 21,
        width: 12,
        height: 6,
        properties: {
          title: 'API requests & errors',
          region: 'eu-central-1',
          view: 'timeSeries',
          period: FIVE_MINUTES_SECONDS,
          stat: 'Sum',
          metrics: [apigw('Count', 'requests'), apigw('4xx', '4xx'), apigw('5xx', '5xx')],
        },
      },
      {
        type: 'metric',
        x: 12,
        y: 21,
        width: 12,
        height: 6,
        properties: {
          title: 'API latency (ms)',
          region: 'eu-central-1',
          view: 'timeSeries',
          period: FIVE_MINUTES_SECONDS,
          metrics: [
            apigw('Latency', 'p50', 'p50'),
            apigw('Latency', 'p95', 'p95'),
            apigw('Latency', 'p99', 'p99'),
          ],
        },
      },

      // Row 5 — DynamoDB. Tables are on-demand, so capacity is a cost/volume
      // read; throttles are the thing that would actually break a request.
      {
        type: 'metric',
        x: 0,
        y: 27,
        width: 12,
        height: 6,
        properties: {
          title: 'DynamoDB consumed capacity',
          region: 'eu-central-1',
          view: 'timeSeries',
          period: FIVE_MINUTES_SECONDS,
          stat: 'Sum',
          metrics: [
            ...tables.map((t) => ddb('ConsumedReadCapacityUnits', t, ' read')),
            ...tables.map((t) => ddb('ConsumedWriteCapacityUnits', t, ' write')),
          ],
        },
      },
      {
        type: 'metric',
        x: 12,
        y: 27,
        width: 12,
        height: 6,
        properties: {
          title: 'DynamoDB throttled requests',
          region: 'eu-central-1',
          view: 'timeSeries',
          period: FIVE_MINUTES_SECONDS,
          stat: 'Sum',
          metrics: [
            ...tables.map((t) => ddb('ReadThrottleEvents', t, ' read')),
            ...tables.map((t) => ddb('WriteThrottleEvents', t, ' write')),
          ],
        },
      },
    ],
  });
});

new aws.cloudwatch.Dashboard('OpsDashboard', {
  dashboardName: `techtok-${$app.stage}`,
  dashboardBody,
});

// Tag-based view grouping every resource carrying the `app` default tag
// (D17) so the console shows one place per environment for billing/ops.
new aws.resourcegroups.Group('AppResourceGroup', {
  name: $app.stage === 'production' ? 'techtok-production' : 'techtok-dev',
  resourceQuery: {
    query: JSON.stringify({
      ResourceTypeFilters: ['AWS::AllSupported'],
      TagFilters: [
        {
          Key: 'app',
          Values: [$app.stage === 'production' ? 'techtok-production' : 'techtok-dev'],
        },
      ],
    }),
  },
});

// Infrastructure-drift signal, not an enforced ceiling (D74, amending D11).
new aws.budgets.Budget('MonthlyCostBudget', {
  budgetType: 'COST',
  limitAmount: '25',
  limitUnit: 'USD',
  timeUnit: 'MONTHLY',
  notifications: [
    {
      comparisonOperator: 'GREATER_THAN',
      notificationType: 'ACTUAL',
      threshold: 80,
      thresholdType: 'PERCENTAGE',
      subscriberSnsTopicArns: [alertTopic.arn],
    },
    {
      comparisonOperator: 'GREATER_THAN',
      notificationType: 'FORECASTED',
      threshold: 100,
      thresholdType: 'PERCENTAGE',
      subscriberSnsTopicArns: [alertTopic.arn],
    },
  ],
});
