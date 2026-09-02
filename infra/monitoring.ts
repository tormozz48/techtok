import { api } from './api';
import { contentDlq, ingestPipeline, transformDlq, translateDlq } from './pipeline';

const queueName = (arn: $util.Output<string>) => arn.apply((a) => a.split(':').at(-1) ?? a);

const isProduction = $app.stage === 'production';

const productionAlarm = (name: string, args: aws.cloudwatch.MetricAlarmArgs): void => {
  if (isProduction) new aws.cloudwatch.MetricAlarm(name, args);
};

const FIVE_MINUTES_SECONDS = 300;
const FOUR_HOURS_SECONDS = 14400;

export const alertTopic = new aws.sns.Topic('AlertTopic', {});

new aws.sns.TopicSubscription('AlertEmail', {
  topic: alertTopic.arn,
  protocol: 'email',
  endpoint: 'tormozz48@gmail.com',
});

productionAlarm('DlqDepthAlarm', {
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

productionAlarm('TranslateDlqDepthAlarm', {
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

productionAlarm('ContentDlqDepthAlarm', {
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

productionAlarm('IngestPipelineFailedAlarm', {
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

productionAlarm('Api5xxAlarm', {
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

productionAlarm('IngestStalledAlarm', {
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
});

productionAlarm('LambdaThrottledAlarm', {
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
});

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
