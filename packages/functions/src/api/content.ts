import { Logger } from '@aws-lambda-powertools/logger';
import {
  type ContentDeps,
  ContentStore,
  CountersRepo,
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
import { type CompactFigure, type ContentResponse, contentQuerySchema } from '@techtok/shared';
import { requireEnv } from '../env';
import { lazy } from '../lazy';
import { getDynamoClient, getPostsRepo, getSourcesRepo } from '../repos';
import { errorResponse, jsonResponse, parseQuery, withDeviceId } from './http';

const logger = new Logger({ serviceName: 'content' });

const FETCH_TIMEOUT_MS = 10_000;
const MAX_BYTES = 2 * 1024 * 1024;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const DEFAULT_COMPACT_DAILY_CAP = 20;
const compactCap = Number(process.env.COMPACT_DAILY_CAP ?? DEFAULT_COMPACT_DAILY_CAP);

const getS3Client = lazy(createS3Client);
const getRawArticleStore = lazy(
  () => new RawArticleStore(getS3Client(), requireEnv('RAW_ARTICLES_BUCKET_NAME')),
);
const getImageStore = lazy(() => new ImageStore(getS3Client(), requireEnv('IMAGES_BUCKET_NAME')));
const getContentStore = lazy(
  () => new ContentStore(getS3Client(), requireEnv('CONTENT_BUCKET_NAME')),
);
const getCountersRepo = lazy(
  () => new CountersRepo(getDynamoClient(), requireEnv('COUNTERS_TABLE_NAME')),
);
const getBedrockProvider = lazy(() =>
  createBedrockProvider(createBedrockClient(), requireEnv('BEDROCK_MODEL_ID')),
);

function todayDate(): string {
  return new Date().toISOString().slice(0, 10);
}

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

export const handler = withDeviceId(async (event, _deviceId) => {
  const postId = event.pathParameters?.postId;
  if (!postId) {
    return errorResponse(400, 'missing_post_id', 'postId path parameter is required');
  }

  const query = parseQuery(event, contentQuerySchema);
  if (!query.ok) return query.response;
  const { lang } = query.data;

  const repo = getPostsRepo();
  const [post] = await repo.getByIds([postId]);
  if (!post) {
    return errorResponse(404, 'not_found', `post ${postId} not found`);
  }

  const contentStore = getContentStore();
  const cached = await contentStore.getContent(postId, lang);
  if (cached) {
    return jsonResponse(200, {
      available: true,
      lang,
      blocks: cached.blocks,
      figures: cached.figures,
    } satisfies ContentResponse);
  }

  const provider = getBedrockProvider();
  const deps: ContentDeps = {
    compactEnabled: async () => {
      const source = await getSourcesRepo().getById(post.sourceId);
      return source?.compactEnabled !== false;
    },
    checkDailyCap: () =>
      getCountersRepo().incrementIfUnderCap(`compacts#${todayDate()}`, compactCap),
    loadArticleHtml: () => loadArticleHtml(post),
    mirrorFigures: (figures) => mirrorFigures(postId, figures),
    generateCompact: (input) => compactArticleViaLlm(input, provider),
    writeContent: async (blocks, figures) => {
      await contentStore.putContent(postId, lang, { blocks, figures });
      const nextLangs = Array.from(new Set([...(post.compactLangs ?? []), lang]));
      await repo.setCompactLangs(postId, nextLangs);
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

  if (!outcome.ok) {
    logger.info('content generation degraded', { postId, lang, reason: outcome.reason });
    return jsonResponse(200, {
      available: false,
      reason: outcome.reason,
    } satisfies ContentResponse);
  }

  return jsonResponse(200, {
    available: true,
    lang,
    blocks: outcome.blocks,
    figures: outcome.figures,
  } satisfies ContentResponse);
});
