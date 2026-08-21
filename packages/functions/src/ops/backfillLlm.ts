import { Logger } from '@aws-lambda-powertools/logger';
import { createSqsClient, TransformQueue } from '@techtok/core';
import { requireEnv } from '../env';
import { BACKFILL_PAGE_SIZE } from '../limits';
import { getPostsRepo } from '../repos';

const logger = new Logger({ serviceName: 'backfillLlm' });

export async function handler(): Promise<void> {
  const repo = getPostsRepo();
  const queue = new TransformQueue(createSqsClient(), requireEnv('TRANSFORM_QUEUE_URL'));

  let before: string | undefined;
  let scanned = 0;
  let enqueued = 0;

  for (;;) {
    const page = await repo.queryRecent({ limit: BACKFILL_PAGE_SIZE, before });
    if (page.length === 0) break;

    scanned += page.length;
    const toReenqueue = page.filter((post) => post.transform === 'excerpt');
    if (toReenqueue.length > 0) {
      await queue.enqueueNew(toReenqueue);
      enqueued += toReenqueue.length;
    }

    const last = page[page.length - 1];
    if (!last) break;
    before = last.publishedAt;
  }

  logger.info('backfill enqueue complete', { scanned, enqueued });
}
