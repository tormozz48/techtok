import { Logger } from '@aws-lambda-powertools/logger';
import {
  createS3Client,
  errorMessage,
  DEFAULT_TIMEOUT_MS as FETCH_TIMEOUT_MS,
  fetchBytesWithCap,
  ImageStore,
  RawArticleStore,
  backfillImages as runBackfillImages,
} from '@techtok/core';
import { requireEnv } from '../env';
import { lazy } from '../lazy';
import { BACKFILL_PAGE_SIZE, MAX_IMAGE_BYTES } from '../limits';
import { getPostsRepo } from '../repos';

const logger = new Logger({ serviceName: 'backfillImages' });

const getS3Client = lazy(createS3Client);
const getRawArticleStore = lazy(
  () => new RawArticleStore(getS3Client(), requireEnv('RAW_ARTICLES_BUCKET_NAME')),
);
const getImageStore = lazy(() => new ImageStore(getS3Client(), requireEnv('IMAGES_BUCKET_NAME')));

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
  const page = await getPostsRepo().queryRecent({ limit: BACKFILL_PAGE_SIZE, before });
  if (page.length === 0) return { candidates: [], nextBefore: undefined };

  const records = await getPostsRepo().getByIds(page.map((post) => post.postId));
  const candidates = records.flatMap((post) => {
    if (post.imageUrl || post.mirroredImageUrl || !post.s3RawKey) return [];
    return [{ postId: post.postId, url: post.url, s3RawKey: post.s3RawKey }];
  });

  const last = page[page.length - 1];
  return { candidates, nextBefore: last?.publishedAt };
}
