import { Logger } from '@aws-lambda-powertools/logger';
import {
  type ContentDeps,
  ContentStore,
  compactArticle as compactArticleViaLlm,
  createConfiguredLlmProvider,
  createS3Client,
  type ExtractedFigure,
  errorMessage,
  fetchBytesWithCap,
  fetchTextWithCap,
  generateContentArticle,
  ImageStore,
  isAllowedByRobots,
  isCompactEnabled,
  RawArticleStore,
} from '@techtok/core';
import { type CompactFigure, isLanguage, type Language } from '@techtok/shared';
import type { SQSBatchResponse, SQSEvent, SQSHandler } from 'aws-lambda';
import { requireEnv } from '../env';
import { lazy } from '../lazy';
import { getPostsRepo, getSourcesRepo } from '../repos';

const logger = new Logger({ serviceName: 'content' });

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
const getLlmProvider = lazy(() => createConfiguredLlmProvider(process.env));

function fetchBytes(url: string, maxBytes: number) {
  return fetchBytesWithCap(url, { maxBytes, timeoutMs: FETCH_TIMEOUT_MS });
}

function fetchText(url: string, maxBytes = MAX_BYTES) {
  return fetchTextWithCap(url, { maxBytes, timeoutMs: FETCH_TIMEOUT_MS });
}

async function mirrorFigures(postId: string, figures: ExtractedFigure[]): Promise<CompactFigure[]> {
  const mirrored = await Promise.all(
    figures.map(async (figure, index): Promise<CompactFigure | undefined> => {
      try {
        const { body, contentType } = await fetchBytes(figure.url, MAX_IMAGE_BYTES);
        const key = await getImageStore().putImage(
          postId,
          body,
          contentType ?? 'image/jpeg',
          `-fig${index}`,
        );
        return { url: `${requireEnv('IMAGES_CDN_BASE_URL')}/${key}`, caption: figure.caption };
      } catch (err) {
        logger.warn('figure mirror failed, dropping figure', {
          postId,
          url: figure.url,
          error: errorMessage(err),
        });
        return undefined;
      }
    }),
  );
  return mirrored.filter((figure): figure is CompactFigure => figure !== undefined);
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
  readonly postId: string;
  readonly lang: Language;
}

function parseMessageBody(body: string): MessageBody {
  const parsed = JSON.parse(body) as Partial<Record<'postId' | 'lang', string>>;
  if (!parsed.postId || !parsed.lang || !isLanguage(parsed.lang)) {
    throw new Error('content message missing postId/lang');
  }
  return { postId: parsed.postId, lang: parsed.lang };
}

/**
 * Consumes eager per-language compact-generation messages enqueued by
 * `transformArticle` (D36) — one per language, for every post. On the first
 * message it processes for a given post (`Posts.mirroredFigures` absent), it
 * extracts + mirrors that post's in-body figures once and persists them;
 * every other language reuses the stored list. Two language jobs racing on a
 * brand-new post's first message may both see `mirroredFigures` absent and
 * both mirror — last-write-wins, an accepted narrow-race tradeoff (D36), not
 * guarded against.
 */
export const handler: SQSHandler = async (event: SQSEvent): Promise<SQSBatchResponse> => {
  const postsRepo = getPostsRepo();
  const contentStore = getContentStore();
  const provider = getLlmProvider();
  const batchItemFailures: SQSBatchResponse['batchItemFailures'] = [];

  for (const record of event.Records) {
    try {
      const { postId, lang } = parseMessageBody(record.body);
      const [post] = await postsRepo.getByIds([postId]);
      if (!post) {
        throw new Error(`post ${postId} not found for content job`);
      }

      const deps: ContentDeps = {
        compactEnabled: async () => {
          const source = await getSourcesRepo().getById(post.sourceId);
          return isCompactEnabled(source);
        },
        loadArticleHtml: () => loadArticleHtml(post),
        mirrorFigures: (figures) => mirrorFigures(postId, figures),
        saveMirroredFigures: (figures) => postsRepo.setMirroredFigures(postId, figures),
        generateCompact: (input) => compactArticleViaLlm(input, provider),
        writeContent: async (blocks, figures) => {
          await contentStore.putContent(postId, lang, { blocks, figures });
          await postsRepo.appendCompactLang(postId, lang);
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
          mirroredFigures: post.mirroredFigures,
        },
        deps,
      );

      if (outcome.ok) {
        logger.info('content generated', { postId, lang });
      } else {
        logger.info('content generation degraded', { postId, lang, reason: outcome.reason });
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
