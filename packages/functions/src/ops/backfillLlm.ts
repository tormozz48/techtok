import { Logger } from '@aws-lambda-powertools/logger';
import { createSqsClient, TransformQueue } from '@techtok/core';
import { requireEnv } from '../env';
import { getPostsRepo } from '../repos';

const logger = new Logger({ serviceName: 'backfillLlm' });
const PAGE_SIZE = 100;

/**
 * One-shot backfill (IMPLEMENTATION_PLAN.md phase 3 task 7): re-enqueues
 * existing `transform=excerpt` posts through the transform path so they pick
 * up real LLM card copy + topic classification. Safe to invoke repeatedly —
 * the daily cap (DESIGN §7.4) still governs how many of these actually call
 * Bedrock per run, and re-transforming a post just overwrites the same
 * fields (idempotent, per DESIGN §7.2).
 * Not wired to any schedule/route — invoke manually:
 *   aws lambda invoke --function-name <fn> out.json
 */
export async function handler(): Promise<void> {
  const repo = getPostsRepo();
  const queue = new TransformQueue(createSqsClient(), requireEnv('TRANSFORM_QUEUE_URL'));

  let before: string | undefined;
  let scanned = 0;
  let enqueued = 0;

  for (;;) {
    const page = await repo.queryRecent({ limit: PAGE_SIZE, before });
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
