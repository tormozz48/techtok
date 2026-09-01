import { Logger } from '@aws-lambda-powertools/logger';
import { Metrics, MetricUnit } from '@aws-lambda-powertools/metrics';
import type { IngestResult } from '@techtok/core';
import { getPostsRepo, getUsersRepo } from '../repos';

const logger = new Logger({ serviceName: 'summarize' });
const metrics = new Metrics({ namespace: 'TechTok', serviceName: 'ingest' });

export async function handler(results: IngestResult[]): Promise<void> {
  const seen = results.reduce((sum, r) => sum + r.seen, 0);
  const created = results.reduce((sum, r) => sum + r.created, 0);
  const sourcesWithErrors = results.filter((r) => r.errors.length > 0).length;

  metrics.addMetric('IngestedCount', MetricUnit.Count, seen);
  metrics.addMetric('NewPostCount', MetricUnit.Count, created);
  metrics.addMetric('SourceErrorCount', MetricUnit.Count, sourcesWithErrors);
  metrics.publishStoredMetrics();

  logger.info('ingest run summarized', {
    sources: results.length,
    seen,
    created,
    sourcesWithErrors,
  });

  const [expiredPosts, prunedQuotas] = await Promise.all([
    getPostsRepo().deleteExpired(),
    getUsersRepo().pruneOldQuotas(),
  ]);
  logger.info('expiry sweep complete', { expiredPosts, prunedQuotas });
}
