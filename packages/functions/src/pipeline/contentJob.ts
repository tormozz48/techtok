import { Logger } from '@aws-lambda-powertools/logger';
import {
  type ContentDeps,
  ContentStore,
  compactArticle as compactArticleViaLlm,
  createBedrockClient,
  createBedrockProvider,
  createS3Client,
  type ExtractedFigure,
  errorMessage,
  generateContentArticle,
  ImageStore,
  isAllowedByRobots,
  RawArticleStore,
  TECHTOK_BOT_USER_AGENT,
} from '@techtok/core';
import { type CompactFigure, isLanguage, type Language } from '@techtok/shared';
import type { SQSBatchResponse, SQSEvent, SQSHandler } from 'aws-lambda';
import { requireEnv } from '../env';
import { lazy } from '../lazy';
import { getContentJobsRepo, getPostsRepo, getSourcesRepo } from '../repos';

const logger = new Logger({ serviceName: 'content-job' });

const FETCH_TIMEOUT_MS = 10_000;
const MAX_BYTES = 2 * 1024 * 1024;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

const getS3Client = lazy(createS3Client);
const getRawArticleStore = lazy(
  () => new RawArticleStore(getS3Client(), requireEnv('RAW_ARTICLES_BUCKET_NAME')),
);
const getImageStore = lazy(() => new ImageStore(getS3Client(), requireEnv('IMAGES_BUCKET_NAME')));
const getContentStore = lazy(
  () => new ContentStore(getS3Client(), requireEnv('CONTENT_BUCKET_NAME')),
);
const getBedrockProvider = lazy(() =>
  createBedrockProvider(createBedrockClient(), requireEnv('BEDROCK_MODEL_ID')),
);

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

async function mirrorFigures(postId: string, figures: ExtractedFigure[]): Promise<CompactFigure[]> {
  const mirrored: CompactFigure[] = [];
  for (const [index, figure] of figures.entries()) {
    try {
      const { body, contentType } = await fetchBytes(figure.url, MAX_IMAGE_BYTES);
      const key = await getImageStore().putImage(
        postId,
        body,
        contentType ?? 'image/jpeg',
        `-fig${index}`,
      );
      mirrored.push({
        url: `${requireEnv('IMAGES_CDN_BASE_URL')}/${key}`,
        caption: figure.caption,
      });
    } catch (err) {
      logger.warn('figure mirror failed, dropping figure', {
        postId,
        url: figure.url,
        error: errorMessage(err),
      });
    }
  }
  return mirrored;
}

/** Archive-first (D23): the archived raw HTML this post's transform already
 * saved, one live fetch attempt (robots-respecting, same caps as transform)
 * only when the archive is missing or unreadable. */
async function loadArticleHtml(post: { s3RawKey?: string; url: string }): Promise<string> {
  if (post.s3RawKey) {
    try {
      return await getRawArticleStore().getRaw(post.s3RawKey);
    } catch (err) {
      logger.warn('archived html unavailable, attempting live fetch', {
        url: post.url,
        error: errorMessage(err),
      });
    }
  }

  const robotsUrl = new URL('/robots.txt', post.url).toString();
  const robotsTxt = await fetchText(robotsUrl).catch(() => undefined);
  const allowed = await isAllowedByRobots(post.url, async () => robotsTxt);
  if (!allowed) throw new Error('disallowed by robots.txt');
  return fetchText(post.url);
}

interface MessageBody {
  readonly jobId: string;
  readonly postId: string;
  readonly lang: Language;
}

function parseMessageBody(body: string): MessageBody {
  const parsed = JSON.parse(body) as Partial<Record<'jobId' | 'postId' | 'lang', string>>;
  if (!parsed.jobId || !parsed.postId || !parsed.lang || !isLanguage(parsed.lang)) {
    throw new Error('content job message missing jobId/postId/lang');
  }
  return { jobId: parsed.jobId, postId: parsed.postId, lang: parsed.lang };
}

/**
 * Runs the actual compact-article generation for a job started by `POST
 * .../content` (D27) — same `generateContentArticle` core logic as before,
 * only the transport changed. Stage transitions are stamped by wrapping each
 * dep, so `contentArticle.ts` itself needs no knowledge of jobs at all.
 */
export const handler: SQSHandler = async (event: SQSEvent): Promise<SQSBatchResponse> => {
  const postsRepo = getPostsRepo();
  const contentStore = getContentStore();
  const jobs = getContentJobsRepo();
  const provider = getBedrockProvider();
  const batchItemFailures: SQSBatchResponse['batchItemFailures'] = [];

  for (const record of event.Records) {
    try {
      const { jobId, postId, lang } = parseMessageBody(record.body);
      const [post] = await postsRepo.getByIds([postId]);
      if (!post) {
        throw new Error(`post ${postId} not found for content job ${jobId}`);
      }

      const deps: ContentDeps = {
        compactEnabled: async () => {
          const source = await getSourcesRepo().getById(post.sourceId);
          return source?.compactEnabled !== false;
        },
        loadArticleHtml: async () => {
          await jobs.updateStage(jobId, 'fetching');
          return loadArticleHtml(post);
        },
        mirrorFigures: async (figures) => {
          await jobs.updateStage(jobId, 'extracting');
          return mirrorFigures(postId, figures);
        },
        generateCompact: async (input) => {
          await jobs.updateStage(jobId, 'translating');
          return compactArticleViaLlm(input, provider);
        },
        writeContent: async (blocks, figures) => {
          await contentStore.putContent(postId, lang, { blocks, figures });
          const nextLangs = Array.from(new Set([...(post.compactLangs ?? []), lang]));
          await postsRepo.setCompactLangs(postId, nextLangs);
        },
      };

      const outcome = await generateContentArticle(
        {
          postId,
          lang,
          title: post.cardTitle || post.origTitle,
          sourceName: post.sourceName,
          url: post.url,
          leadImageUrl: post.mirroredImageUrl ?? post.imageUrl,
        },
        deps,
      );

      if (outcome.ok) {
        await jobs.complete(jobId, {
          available: true,
          blocks: outcome.blocks,
          figures: outcome.figures,
        });
      } else {
        logger.info('content generation degraded', { postId, lang, jobId, reason: outcome.reason });
        await jobs.complete(jobId, { available: false, reason: outcome.reason });
      }
    } catch (err) {
      logger.error('content job failed for message', {
        messageId: record.messageId,
        error: errorMessage(err),
      });
      batchItemFailures.push({ itemIdentifier: record.messageId });
    }
  }

  return { batchItemFailures };
};
