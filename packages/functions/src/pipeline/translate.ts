import { Logger } from '@aws-lambda-powertools/logger';
import {
  CountersRepo,
  createBedrockClient,
  createBedrockProvider,
  errorMessage,
  translateArticle,
  translateCard as translateCardViaLlm,
} from '@techtok/core';
import { isLanguage, type Language } from '@techtok/shared';
import type { SQSBatchResponse, SQSEvent, SQSHandler } from 'aws-lambda';
import { requireEnv } from '../env';
import { lazy } from '../lazy';
import { getDynamoClient, getPostsRepo } from '../repos';

const logger = new Logger({ serviceName: 'translate' });

const DEFAULT_DAILY_TRANSLATION_CAP = 100;
const translationCap = Number(process.env.TRANSLATION_DAILY_CAP ?? DEFAULT_DAILY_TRANSLATION_CAP);

const getCountersRepo = lazy(
  () => new CountersRepo(getDynamoClient(), requireEnv('COUNTERS_TABLE_NAME')),
);
const getBedrockProvider = lazy(() =>
  createBedrockProvider(createBedrockClient(), requireEnv('BEDROCK_MODEL_ID')),
);

function todayDate(): string {
  return new Date().toISOString().slice(0, 10);
}

interface MessageBody {
  readonly postId: string;
  readonly lang: Language;
}

function parseMessageBody(body: string): MessageBody {
  const parsed = JSON.parse(body) as Partial<Record<'postId' | 'lang', string>>;
  if (!parsed.postId || !parsed.lang || !isLanguage(parsed.lang)) {
    throw new Error('translate message missing postId/lang');
  }
  return { postId: parsed.postId, lang: parsed.lang };
}

export const handler: SQSHandler = async (event: SQSEvent): Promise<SQSBatchResponse> => {
  const repo = getPostsRepo();
  const counters = getCountersRepo();
  const provider = getBedrockProvider();
  const batchItemFailures: SQSBatchResponse['batchItemFailures'] = [];

  for (const record of event.Records) {
    try {
      const { postId, lang } = parseMessageBody(record.body);
      const [post] = await repo.getByIds([postId]);
      if (!post) {
        throw new Error(`post ${postId} not found for translate`);
      }
      const outcome = await translateArticle(
        {
          postId,
          lang,
          cardTitle: post.cardTitle,
          summary: post.summary,
          whyItMatters: post.whyItMatters,
        },
        {
          checkDailyCap: () =>
            counters.incrementIfUnderCap(`translations#${todayDate()}`, translationCap),
          translateCard: (input) => translateCardViaLlm(input, provider),
          writeTranslation: (id, translatedLang, fields) =>
            repo.writeTranslation(id, translatedLang, fields),
          clearPending: (id, translatedLang) => repo.clearI18nPending(id, translatedLang),
        },
      );
      logger.info(outcome.translated ? 'translation completed' : 'translation skipped', {
        postId,
        lang,
        reason: outcome.reason,
      });
    } catch (err) {
      logger.error('translate failed for message', {
        messageId: record.messageId,
        error: errorMessage(err),
      });
      batchItemFailures.push({ itemIdentifier: record.messageId });
    }
  }

  return { batchItemFailures };
};
