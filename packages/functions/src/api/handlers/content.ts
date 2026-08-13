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

/**
 * Reads a compact article (D23; eager generation as of D36) — a plain S3
 * cache read, no job ids or polling. Generation already happened during
 * ingest (`transformArticle`'s eager per-language enqueue), so a miss here is
 * either a source with the compact-reader kill switch on, or the rare case a
 * just-ingested post's eager job hasn't finished yet. Never calls the LLM on
 * this request path.
 *
 * D69: also the free tier's reader-opens gate. Counts as an "open" the
 * moment the request is allowed through, regardless of whether the content
 * turns out to be cached, not-ready, or compact-disabled — the user still
 * spent one of their daily opens tapping into the reader.
 */
export const handler = withAuth(async (event, auth) => {
  const postId = event.pathParameters?.postId;
  if (!postId) {
    return errorResponse(400, 'missing_post_id', 'postId path parameter is required');
  }

  const query = parseQuery(event, contentQuerySchema);
  if (!query.ok) return query.response;
  const { lang } = query.data;

  const user = await getUsersRepo().touch(auth.userId, { email: auth.email, name: auth.name });
  const timezone = user.timezone ?? 'UTC';
  if (!isPlus(user)) {
    const quota = effectiveQuota(user.quota, timezone);
    if (quota.readerOpens >= FREE_READER_OPENS_PER_DAY) {
      return errorResponse(402, 'quota_exceeded', 'Daily reader-open limit reached.');
    }
  }

  const [post] = await getPostsRepo().getByIds([postId]);
  if (!post) {
    return errorResponse(404, 'not_found', `post ${postId} not found`);
  }

  if (!isPlus(user)) {
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
