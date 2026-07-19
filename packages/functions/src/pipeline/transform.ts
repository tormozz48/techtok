import { Logger } from '@aws-lambda-powertools/logger';
import {
  createDynamoClient,
  createPostsRepo,
  createRawArticleStore,
  createS3Client,
  type PostsRepo,
  type RawArticleStore,
  transformArticle,
} from '@techtok/core';
import type { SQSBatchResponse, SQSEvent, SQSHandler } from 'aws-lambda';
import { requireEnv } from '../env';

const logger = new Logger({ serviceName: 'transform' });

const FETCH_TIMEOUT_MS = 10_000;
const MAX_BYTES = 2 * 1024 * 1024;
const USER_AGENT = 'TechTokBot/1.0 (+https://github.com/tormozz48/techtok)';

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

// Per-invocation only (not cross-invocation) — good enough at this batch
// size (<=5 messages), avoids a repeat robots.txt fetch per host in a batch.
const robotsCache = new Map<string, string | undefined>();

async function fetchText(url: string, maxBytes = MAX_BYTES): Promise<string> {
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
    if (!response.body) return await response.text();

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
    return Buffer.concat(chunks).toString('utf8');
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchRobotsTxt(robotsUrl: string): Promise<string | undefined> {
  if (robotsCache.has(robotsUrl)) return robotsCache.get(robotsUrl);
  const text = await fetchText(robotsUrl).catch(() => undefined);
  robotsCache.set(robotsUrl, text);
  return text;
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
  const batchItemFailures: SQSBatchResponse['batchItemFailures'] = [];

  for (const record of event.Records) {
    try {
      const { postId, url } = parseMessageBody(record.body);
      const outcome = await transformArticle(
        { postId, url },
        {
          fetchRobotsTxt,
          fetchPage: (pageUrl) => fetchText(pageUrl),
          archiveRaw: (id, html) => rawStore.archiveRaw(id, html),
          updatePost: (id, fields) => repo.updateTransform(id, fields),
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
