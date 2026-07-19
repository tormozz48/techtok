import { Logger } from '@aws-lambda-powertools/logger';
import {
  type CountersRepo,
  createBedrockClient,
  createBedrockProvider,
  createCountersRepo,
  createDynamoClient,
  createImageStore,
  createPostsRepo,
  createRawArticleStore,
  createS3Client,
  generateCard as generateCardViaLlm,
  type ImageStore,
  type PostsRepo,
  type RawArticleStore,
  transformArticle,
} from '@techtok/core';
import type { SQSBatchResponse, SQSEvent, SQSHandler } from 'aws-lambda';
import { requireEnv } from '../env';

const logger = new Logger({ serviceName: 'transform' });

const FETCH_TIMEOUT_MS = 10_000;
const MAX_BYTES = 2 * 1024 * 1024;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const USER_AGENT = 'TechTokBot/1.0 (+https://github.com/tormozz48/techtok)';
const DEFAULT_DAILY_CAP = 120;

let postsRepo: PostsRepo | undefined;
function getPostsRepo(): PostsRepo {
  postsRepo ??= createPostsRepo(createDynamoClient(), requireEnv('POSTS_TABLE_NAME'));
  return postsRepo;
}

let rawArticleStore: RawArticleStore | undefined;
function getRawArticleStore(): RawArticleStore {
  rawArticleStore ??= createRawArticleStore(
    createS3Client(),
    requireEnv('RAW_ARTICLES_BUCKET_NAME'),
  );
  return rawArticleStore;
}

let imageStore: ImageStore | undefined;
function getImageStore(): ImageStore {
  imageStore ??= createImageStore(createS3Client(), requireEnv('IMAGES_BUCKET_NAME'));
  return imageStore;
}

let countersRepo: CountersRepo | undefined;
function getCountersRepo(): CountersRepo {
  countersRepo ??= createCountersRepo(createDynamoClient(), requireEnv('COUNTERS_TABLE_NAME'));
  return countersRepo;
}

let bedrockProvider: ReturnType<typeof createBedrockProvider> | undefined;
function getBedrockProvider(): ReturnType<typeof createBedrockProvider> {
  bedrockProvider ??= createBedrockProvider(createBedrockClient(), requireEnv('BEDROCK_MODEL_ID'));
  return bedrockProvider;
}

const dailyCap = Number(process.env.LLM_DAILY_CAP ?? DEFAULT_DAILY_CAP);

function todayDate(): string {
  return new Date().toISOString().slice(0, 10);
}

// Per-invocation only (not cross-invocation) — good enough at this batch
// size (<=5 messages), avoids a repeat robots.txt fetch per host in a batch.
const robotsCache = new Map<string, string | undefined>();

interface FetchedBytes {
  body: Buffer;
  contentType: string | undefined;
}

async function fetchBytes(url: string, maxBytes: number): Promise<FetchedBytes> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT },
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

/** Content-level: any fetch/upload failure degrades to the original hotlinked
 * imageUrl at the Card DTO layer (toCard.ts) — never blocks or retries the post. */
async function mirrorImage(postId: string, imageUrl: string): Promise<string | undefined> {
  try {
    const { body, contentType } = await fetchBytes(imageUrl, MAX_IMAGE_BYTES);
    const key = await getImageStore().putImage(postId, body, contentType ?? 'image/jpeg');
    return `${requireEnv('IMAGES_CDN_BASE_URL')}/${key}`;
  } catch (err) {
    logger.warn('image mirror failed, keeping original hotlinked url', {
      postId,
      imageUrl,
      error: err instanceof Error ? err.message : String(err),
    });
    return undefined;
  }
}

interface MessageBody {
  postId: string;
  url: string;
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
  const counters = getCountersRepo();
  const provider = getBedrockProvider();
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
          checkDailyCap: () => counters.incrementIfUnderCap(todayDate(), dailyCap),
          generateCard: (cardInput) => generateCardViaLlm(cardInput, provider),
          updatePost: (id, fields) => repo.updateTransform(id, fields),
          mirrorImage,
        },
      );
      logger.info(outcome.degraded ? 'transform degraded to excerpt' : 'transform completed', {
        postId,
        reason: outcome.reason,
      });
    } catch (err) {
      logger.error('transform failed for message', {
        messageId: record.messageId,
        error: err instanceof Error ? err.message : String(err),
      });
      batchItemFailures.push({ itemIdentifier: record.messageId });
    }
  }

  return { batchItemFailures };
};
