import { Logger } from '@aws-lambda-powertools/logger';
import {
  checkImageQuality,
  createConfiguredLlmProvider,
  createS3Client,
  errorMessage,
  generateCard as generateCardViaLlm,
  ImageStore,
  type MirrorImageResult,
  RawArticleStore,
  TECHTOK_BOT_USER_AGENT,
  transformArticle,
} from '@techtok/core';
import { LANGUAGES } from '@techtok/shared';
import type { SQSBatchResponse, SQSEvent, SQSHandler } from 'aws-lambda';
import { requireEnv } from '../env';
import { lazy } from '../lazy';
import { getPostsRepo, getTranslateQueue } from '../repos';

const logger = new Logger({ serviceName: 'transform' });

const FETCH_TIMEOUT_MS = 10_000;
const MAX_BYTES = 2 * 1024 * 1024;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
// Eager translation (D27): every post gets a job queued for every language
// but the one it was already produced in.
const NON_ENGLISH_LANGUAGES = LANGUAGES.filter((lang) => lang !== 'en');

const getS3Client = lazy(createS3Client);
const getRawArticleStore = lazy(
  () => new RawArticleStore(getS3Client(), requireEnv('RAW_ARTICLES_BUCKET_NAME')),
);
const getImageStore = lazy(() => new ImageStore(getS3Client(), requireEnv('IMAGES_BUCKET_NAME')));
const getLlmProvider = lazy(() => createConfiguredLlmProvider(process.env));

// Per-invocation only (not cross-invocation) — good enough at this batch
// size (<=5 messages), avoids a repeat robots.txt fetch per host in a batch.
const robotsCache = new Map<string, string | undefined>();

interface FetchedBytes {
  readonly body: Buffer;
  readonly contentType: string | undefined;
}

async function fetchBytes(url: string, maxBytes: number): Promise<FetchedBytes> {
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
      if (total > maxBytes) {
        controller.abort();
        throw new Error(`response for ${url} exceeded ${maxBytes} bytes`);
      }
      chunks.push(value);
    }
    return { body: Buffer.concat(chunks), contentType };
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchText(url: string, maxBytes = MAX_BYTES): Promise<string> {
  const { body } = await fetchBytes(url, maxBytes);
  return body.toString('utf8');
}

async function fetchRobotsTxt(robotsUrl: string): Promise<string | undefined> {
  if (robotsCache.has(robotsUrl)) return robotsCache.get(robotsUrl);
  const text = await fetchText(robotsUrl).catch(() => undefined);
  robotsCache.set(robotsUrl, text);
  return text;
}

/** Content-level: an infra-level fetch/upload failure (`'failed'`) degrades to
 * the original hotlinked imageUrl at the Card DTO layer (toCard.ts) — never
 * blocks or retries the post. A quality-level rejection (`'rejected'`, D28)
 * is reported separately so `transformArticle`'s cascade can try the next
 * candidate instead of treating this the same as an infra failure. */
async function mirrorImage(postId: string, imageUrl: string): Promise<MirrorImageResult> {
  try {
    const { body, contentType } = await fetchBytes(imageUrl, MAX_IMAGE_BYTES);
    const quality = checkImageQuality(body);
    if (!quality.passes) {
      logger.info('image mirror rejected image below the quality bar (D28)', {
        postId,
        imageUrl,
        width: quality.width,
        height: quality.height,
      });
      return { status: 'rejected' };
    }
    const key = await getImageStore().putImage(postId, body, contentType ?? 'image/jpeg');
    return { status: 'ok', url: `${requireEnv('IMAGES_CDN_BASE_URL')}/${key}` };
  } catch (err) {
    logger.warn('image mirror failed, keeping original hotlinked url', {
      postId,
      imageUrl,
      error: errorMessage(err),
    });
    return { status: 'failed' };
  }
}

interface MessageBody {
  readonly postId: string;
  readonly url: string;
}

function parseMessageBody(body: string): MessageBody {
  const parsed = JSON.parse(body) as Partial<MessageBody>;
  if (!parsed.postId || !parsed.url) {
    throw new Error('transform message missing postId/url');
  }
  return { postId: parsed.postId, url: parsed.url };
}

export const handler: SQSHandler = async (event: SQSEvent): Promise<SQSBatchResponse> => {
  const repo = getPostsRepo();
  const rawStore = getRawArticleStore();
  const provider = getLlmProvider();
  const batchItemFailures: SQSBatchResponse['batchItemFailures'] = [];

  for (const record of event.Records) {
    try {
      const { postId, url } = parseMessageBody(record.body);
      const [post] = await repo.getByIds([postId]);
      if (!post) {
        throw new Error(`post ${postId} not found for transform`);
      }
      const outcome = await transformArticle(
        {
          postId,
          url,
          title: post.origTitle,
          sourceName: post.sourceName,
          imageUrl: post.imageUrl,
        },
        {
          fetchRobotsTxt,
          fetchPage: (pageUrl) => fetchText(pageUrl),
          archiveRaw: (id, html) => rawStore.archiveRaw(id, html),
          generateCard: (cardInput) => generateCardViaLlm(cardInput, provider),
          updatePost: (id, fields) => repo.updateTransform(id, fields),
          mirrorImage,
          enqueueTranslations: (id) =>
            getTranslateQueue().enqueuePending(
              NON_ENGLISH_LANGUAGES.map((lang) => ({ postId: id, lang })),
            ),
        },
      );
      logger.info(outcome.degraded ? 'transform degraded to excerpt' : 'transform completed', {
        postId,
        reason: outcome.reason,
      });
    } catch (err) {
      logger.error('transform failed for message', {
        messageId: record.messageId,
        error: errorMessage(err),
      });
      batchItemFailures.push({ itemIdentifier: record.messageId });
    }
  }

  return { batchItemFailures };
};
