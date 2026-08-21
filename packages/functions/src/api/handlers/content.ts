import {
  ContentStore,
  createS3Client,
  effectiveQuota,
  FREE_READER_OPENS_PER_DAY,
  isCompactEnabled,
  isPlus,
} from '@techtok/core';
import { type ContentResponse, contentQuerySchema } from '@techtok/shared';
import { requireEnv } from '../../env';
import { lazy } from '../../lazy';
import { getPostsRepo, getSourcesRepo, getUsersRepo } from '../../repos';
import { errorResponse, jsonResponse, parseQuery, withAuth } from '../lib/http';

const getS3Client = lazy(createS3Client);
const getContentStore = lazy(
  () => new ContentStore(getS3Client(), requireEnv('CONTENT_BUCKET_NAME')),
);

export const handler = withAuth(async (event, auth) => {
  const postId = event.pathParameters?.postId;
  if (!postId) {
    return errorResponse(400, 'missing_post_id', 'postId path parameter is required');
  }

  const query = parseQuery(event, contentQuerySchema);
  if (!query.ok) return query.response;
  const { lang, intent } = query.data;
  const isPrefetch = intent === 'prefetch';

  const user = await getUsersRepo().touch(auth.userId, { email: auth.email, name: auth.name });
  const timezone = user.timezone ?? 'UTC';
  if (!isPrefetch && !isPlus(user)) {
    const quota = effectiveQuota(user.quota, timezone);
    if (quota.readerOpens >= FREE_READER_OPENS_PER_DAY) {
      return errorResponse(402, 'quota_exceeded', 'Daily reader-open limit reached.');
    }
  }

  const [post] = await getPostsRepo().getByIds([postId]);
  if (!post) {
    return errorResponse(404, 'not_found', `post ${postId} not found`);
  }

  if (!isPrefetch && !isPlus(user)) {
    await getUsersRepo().incrementQuota(auth.userId, 'readerOpens', timezone);
  }

  const cached = await getContentStore().getContent(postId, lang);
  if (cached) {
    return jsonResponse(200, {
      available: true,
      lang,
      blocks: cached.blocks,
      figures: cached.figures,
    } satisfies ContentResponse);
  }

  const source = await getSourcesRepo().getById(post.sourceId);
  const reason = isCompactEnabled(source) ? 'not ready yet' : 'compactEnabled is false';
  return jsonResponse(200, { available: false, reason } satisfies ContentResponse);
});
