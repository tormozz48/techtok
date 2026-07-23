import { Logger } from '@aws-lambda-powertools/logger';
import { errorMessage, needsTranslation, type PostRecord } from '@techtok/core';
import type { Language } from '@techtok/shared';
import { getPostsRepo, getTranslateQueue } from '../repos';

const logger = new Logger({ serviceName: 'translate-enqueue' });

/**
 * On-demand translation enqueue (DESIGN §5.2 step 7 / D22), shared by the
 * feed and digest paths (phase 10 item 1): for posts about to be served or
 * pushed in a non-EN language without a translation yet, stamp a pending
 * marker and enqueue a translate job. Best-effort — an SQS or DynamoDB
 * hiccup here must never fail the caller, since English is always already
 * available this same cycle.
 */
export async function enqueueTranslations(posts: PostRecord[], lang: Language): Promise<void> {
  const now = new Date();
  const candidates = posts.filter((post) => needsTranslation(post, lang, now));
  if (candidates.length === 0) return;

  try {
    const nowIso = now.toISOString();
    const postsRepo = getPostsRepo();
    await Promise.all(
      candidates.map((post) => postsRepo.setI18nPending(post.postId, lang, nowIso)),
    );
    await getTranslateQueue().enqueuePending(
      candidates.map((post) => ({ postId: post.postId, lang })),
    );
  } catch (err) {
    logger.warn('translation enqueue failed, posts stay english this cycle', {
      lang,
      postIds: candidates.map((post) => post.postId),
      error: errorMessage(err),
    });
  }
}
