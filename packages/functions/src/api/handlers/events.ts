import { Logger } from '@aws-lambda-powertools/logger';
import { Metrics, MetricUnit } from '@aws-lambda-powertools/metrics';
import { eventsRequestSchema } from '@techtok/shared';
import { noContent, parseJsonBody, withAuth } from '../lib/http';

const logger = new Logger({ serviceName: 'events' });
const metrics = new Metrics({ namespace: 'TechTok', serviceName: 'events' });

export const handler = withAuth(async (event, auth) => {
  const body = parseJsonBody(event, eventsRequestSchema);
  if (!body.ok) return body.response;

  for (const record of body.data.records) {
    if (record.kind === 'log') {
      const context = {
        userId: auth.userId,
        context: record.context,
        occurredAt: record.occurredAt,
      };
      if (record.level === 'error') logger.error(record.message, context);
      else if (record.level === 'warn') logger.warn(record.message, context);
      else logger.info(record.message, context);
      metrics.addMetric('ClientLogCount', MetricUnit.Count, 1);
    } else {
      logger.info('client event', {
        userId: auth.userId,
        name: record.name,
        props: record.props,
        occurredAt: record.occurredAt,
      });
      metrics.addMetric('ClientEventCount', MetricUnit.Count, 1);
    }
  }
  metrics.publishStoredMetrics();

  return noContent();
});
