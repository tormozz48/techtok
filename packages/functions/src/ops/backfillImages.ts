import { Logger } from '@aws-lambda-powertools/logger';
import {
  createS3Client,
  errorMessage,
  ImageStore,
  RawArticleStore,
  backfillImages as runBackfillImages,
  TECHTOK_BOT_USER_AGENT,
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

interface FetchedBytes {
  readonly body: Buffer;
  readonly contentType: string | undefined;
}

// Same shape as pipeline/transform.ts's own fetchBytes — this Lambda still
// needs one live fetch per backfilled post (the og:image itself was never
// archived, only the article page was), just not a live refetch of the page.
async function fetchImageBytes(url: string): Promise<FetchedBytes> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': TECHTOK_BOT_USER_AGENT },
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`fetch ${url} failed with status ${response.status}`);
    }
    const contentType = response.headers.get('content-type') ?? undefined;
    if (!response.body) return { body: Buffer.from(await response.arrayBuffer()), contentType };

    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_IMAGE_BYTES) {
        controller.abort();
        throw new Error(`response for ${url} exceeded ${MAX_IMAGE_BYTES} bytes`);
      }
      chunks.push(value);
    }
    return { body: Buffer.concat(chunks), contentType };
  } finally {
    clearTimeout(timeout);
  }
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
