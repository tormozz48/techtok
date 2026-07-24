import { randomUUID } from 'node:crypto';
import { Logger } from '@aws-lambda-powertools/logger';
import { ContentStore, createS3Client } from '@techtok/core';
import { type ContentStartResponse, contentQuerySchema } from '@techtok/shared';
import { requireEnv } from '../env';
import { lazy } from '../lazy';
import { getContentJobQueue, getContentJobsRepo, getPostsRepo } from '../repos';
import { errorResponse, jsonResponse, parseQuery, withDeviceId } from './http';

const logger = new Logger({ serviceName: 'content-start' });

const getS3Client = lazy(createS3Client);
const getContentStore = lazy(
  () => new ContentStore(getS3Client(), requireEnv('CONTENT_BUCKET_NAME')),
);

/**
 * Starts compact-article generation (D23/D27): a cache hit completes the job
 * immediately (no queue round trip needed); a miss enqueues the real
 * generation work to `ContentJobQueue` and returns right away. Either way the
 * caller polls `GET .../content/status?jobId=` for the real outcome — this
 * endpoint never blocks on the ~11s generation itself.
 */
export const handler = withDeviceId(async (event, _deviceId) => {
  const postId = event.pathParameters?.postId;
  if (!postId) {
    return errorResponse(400, 'missing_post_id', 'postId path parameter is required');
  }

  const query = parseQuery(event, contentQuerySchema);
  if (!query.ok) return query.response;
  const { lang } = query.data;

  const [post] = await getPostsRepo().getByIds([postId]);
  if (!post) {
    return errorResponse(404, 'not_found', `post ${postId} not found`);
  }

  const jobId = randomUUID();
  const jobs = getContentJobsRepo();
  await jobs.create(jobId, postId, lang);

  const cached = await getContentStore().getContent(postId, lang);
  if (cached) {
    await jobs.complete(jobId, {
      available: true,
      blocks: cached.blocks,
      figures: cached.figures,
    });
  } else {
    await getContentJobQueue().enqueue({ jobId, postId, lang });
  }

  logger.info('content job started', { postId, lang, jobId, cacheHit: Boolean(cached) });
  return jsonResponse(200, { jobId, status: 'pending' } satisfies ContentStartResponse);
});
