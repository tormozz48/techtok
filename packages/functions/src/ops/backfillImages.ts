import { Logger } from '@aws-lambda-powertools/logger';
import {
  createS3Client,
  errorMessage,
  fetchBytesWithCap,
  ImageStore,
  RawArticleStore,
  backfillImages as runBackfillImages,
} from '@techtok/core';
import { requireEnv } from '../env';
import { lazy } from '../lazy';
import { getPostsRepo } from '../repos';

const logger = new Logger({ serviceName: 'backfillImages' });

const PAGE_SIZE = 100;
const FETCH_TIMEOUT_MS = 10_000;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

const getS3Client = lazy(createS3Client);
const getRawArticleStore = lazy(
  () => new RawArticleStore(getS3Client(), requireEnv('RAW_ARTICLES_BUCKET_NAME')),
);
const getImageStore = lazy(() => new ImageStore(getS3Client(), requireEnv('IMAGES_BUCKET_NAME')));

// This Lambda still needs one live fetch per backfilled post (the og:image
// itself was never archived, only the article page was), just not a live
// refetch of the page.
function fetchImageBytes(url: string) {
  return fetchBytesWithCap(url, { maxBytes: MAX_IMAGE_BYTES, timeoutMs: FETCH_TIMEOUT_MS });
}

async function mirrorImage(postId: string, imageUrl: string): Promise<string | undefined> {
  try {
    const { body, contentType } = await fetchImageBytes(imageUrl);
    const key = await getImageStore().putImage(postId, body, contentType ?? 'image/jpeg');
    return `${requireEnv('IMAGES_CDN_BASE_URL')}/${key}`;
  } catch (err) {
    logger.warn('image mirror failed during backfill', {
      postId,
      imageUrl,
      error: errorMessage(err),
    });
    return undefined;
  }
}

async function nextCandidates(before: string | undefined) {
  const page = await getPostsRepo().queryRecent({ limit: PAGE_SIZE, before });
  if (page.length === 0) return { candidates: [], nextBefore: undefined };

  const candidates = page.flatMap((post) => {
    if (post.imageUrl || post.mirroredImageUrl || !post.s3RawKey) return [];
    return [{ postId: post.postId, url: post.url, s3RawKey: post.s3RawKey }];
  });

  const last = page[page.length - 1];
  return { candidates, nextBefore: last?.publishedAt };
}

/**
 * One-shot backfill (IMPLEMENTATION_PLAN.md phase 7 task 3): for posts
 * lacking any image but holding an archived raw HTML page, mines the page's
 * og:image and mirrors it to the CDN — no LLM, no live article refetch. Safe
 * to invoke repeatedly. Not wired to any schedule/route — invoke manually:
 *   aws lambda invoke --function-name <fn> out.json
 */
export async function handler(): Promise<void> {
  const rawStore = getRawArticleStore();

  const result = await runBackfillImages({
    nextCandidates,
    getRawHtml: (s3RawKey) => rawStore.getRaw(s3RawKey),
    mirrorImage,
    updateMirroredImage: (postId, mirroredImageUrl) =>
      getPostsRepo().updateMirroredImage(postId, mirroredImageUrl),
    onError: (postId, err) => {
      logger.warn('image backfill failed for post', { postId, error: errorMessage(err) });
    },
  });

  logger.info('image backfill complete', { ...result });
}
