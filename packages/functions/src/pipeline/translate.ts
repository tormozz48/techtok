import { Logger } from '@aws-lambda-powertools/logger';
import {
  createConfiguredLlmProvider,
  errorMessage,
  translateArticle,
  translateCard as translateCardViaLlm,
} from '@techtok/core';
import { isLanguage, type Language } from '@techtok/shared';
import type { SQSBatchResponse, SQSEvent, SQSHandler } from 'aws-lambda';
import { lazy } from '../lazy';
import { getPostsRepo } from '../repos';

const logger = new Logger({ serviceName: 'translate' });

const getLlmProvider = lazy(() => createConfiguredLlmProvider(process.env));

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
  const provider = getLlmProvider();
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
          translateCard: (input) => translateCardViaLlm(input, provider),
          writeTranslation: (id, translatedLang, fields) =>
            repo.writeTranslation(id, translatedLang, fields),
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
