import { api } from './api';
import { ingestPipeline, transformDlq, translateDlq } from './pipeline';

// First use of raw provider resources in this repo — SST has no built-in
// Budget/Alarm/SNS component (confirmed against the current component list).
export const alertTopic = new aws.sns.Topic('AlertTopic', {});

new aws.sns.TopicSubscription('AlertEmail', {
  topic: alertTopic.arn,
  protocol: 'email',
  endpoint: 'tormozz48@gmail.com',
});

new aws.cloudwatch.MetricAlarm('DlqDepthAlarm', {
  alarmDescription: 'TransformQueue DLQ has messages — a poison message or a failing transform.',
  comparisonOperator: 'GreaterThanThreshold',
  evaluationPeriods: 1,
  metricName: 'ApproximateNumberOfMessagesVisible',
  namespace: 'AWS/SQS',
  period: 300,
  statistic: 'Maximum',
  threshold: 0,
  dimensions: { QueueName: transformDlq.arn.apply((arn) => arn.split(':').at(-1) ?? arn) },
  alarmActions: [alertTopic.arn],
  treatMissingData: 'notBreaching',
});

new aws.cloudwatch.MetricAlarm('TranslateDlqDepthAlarm', {
  alarmDescription: 'TranslateQueue DLQ has messages — a poison message or a failing translation.',
  comparisonOperator: 'GreaterThanThreshold',
  evaluationPeriods: 1,
  metricName: 'ApproximateNumberOfMessagesVisible',
  namespace: 'AWS/SQS',
  period: 300,
  statistic: 'Maximum',
  threshold: 0,
  dimensions: { QueueName: translateDlq.arn.apply((arn) => arn.split(':').at(-1) ?? arn) },
  alarmActions: [alertTopic.arn],
  treatMissingData: 'notBreaching',
});

new aws.cloudwatch.MetricAlarm('IngestPipelineFailedAlarm', {
  alarmDescription: 'An IngestPipeline execution failed.',
  comparisonOperator: 'GreaterThanThreshold',
  evaluationPeriods: 1,
  metricName: 'ExecutionsFailed',
  namespace: 'AWS/States',
  period: 300,
  statistic: 'Sum',
  threshold: 0,
  dimensions: { StateMachineArn: ingestPipeline.arn },
  alarmActions: [alertTopic.arn],
  treatMissingData: 'notBreaching',
});

new aws.cloudwatch.MetricAlarm('Api5xxAlarm', {
  alarmDescription: 'The API is returning 5xx errors.',
  comparisonOperator: 'GreaterThanThreshold',
  evaluationPeriods: 1,
  metricName: '5xx',
  namespace: 'AWS/ApiGateway',
  period: 300,
  statistic: 'Sum',
  threshold: 0,
  dimensions: { ApiId: api.nodes.api.id },
  alarmActions: [alertTopic.arn],
  treatMissingData: 'notBreaching',
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

// Hobby budget ceiling (D11/§10).
new aws.budgets.Budget('MonthlyCostBudget', {
  budgetType: 'COST',
  limitAmount: '10',
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
