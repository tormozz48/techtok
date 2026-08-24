import { Logger } from '@aws-lambda-powertools/logger';
import {
  checkImageQuality,
  createConfiguredLlmProvider,
  createS3Client,
  errorMessage,
  generateCard as generateCardViaLlm,
  ImageStore,
  isCompactEnabled,
  type MirrorImageResult,
  RawArticleStore,
  type SourceRecord,
  transformArticle,
} from '@techtok/core';
import { LANGUAGES } from '@techtok/shared';
import type { SQSBatchResponse, SQSEvent, SQSHandler } from 'aws-lambda';
import { requireEnv } from '../env';
import { fetchBytes, fetchRobotsTxt, fetchText } from '../httpFetch';
import { lazy } from '../lazy';
import { MAX_IMAGE_BYTES } from '../limits';
import { getContentQueue, getPostsRepo, getSourcesRepo, getTranslateQueue } from '../repos';

const logger = new Logger({ serviceName: 'transform' });

const NON_ENGLISH_LANGUAGES = LANGUAGES.filter((lang) => lang !== 'en');

const getS3Client = lazy(createS3Client);
const getRawArticleStore = lazy(
  () => new RawArticleStore(getS3Client(), requireEnv('RAW_ARTICLES_BUCKET_NAME')),
);
const getImageStore = lazy(() => new ImageStore(getS3Client(), requireEnv('IMAGES_BUCKET_NAME')));
const getLlmProvider = lazy(() => createConfiguredLlmProvider(process.env));

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
  const sourceCache = new Map<string, SourceRecord | undefined>();

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
          fetchPage: fetchText,
          archiveRaw: (id, html) => rawStore.archiveRaw(id, html),
          generateCard: (cardInput) => generateCardViaLlm(cardInput, provider),
          updatePost: (id, fields) => repo.updateTransform(id, fields),
          mirrorImage,
          enqueueTranslations: (id) =>
            getTranslateQueue().enqueuePending(
              NON_ENGLISH_LANGUAGES.map((lang) => ({ postId: id, lang })),
            ),
          enqueueContentJobs: async (id) => {
            let source = sourceCache.get(post.sourceId);
            if (!sourceCache.has(post.sourceId)) {
              source = await getSourcesRepo().getById(post.sourceId);
              sourceCache.set(post.sourceId, source);
            }
            if (!isCompactEnabled(source)) return;
            await getContentQueue().enqueuePending(LANGUAGES.map((lang) => ({ postId: id, lang })));
          },
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
