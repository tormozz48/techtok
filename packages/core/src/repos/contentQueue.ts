import { SendMessageBatchCommand, type SQSClient } from '@aws-sdk/client-sqs';
import type { Language } from '@techtok/shared';
import { chunk } from '../util/chunk';

const SQS_BATCH_LIMIT = 10;

export interface ContentJob {
  readonly postId: string;
  readonly lang: Language;
}

/** Eager per-language compact-article generation jobs (D36) — enqueued by
 * `transformArticle` for every post, same batched-send shape as
 * `TranslateQueue`. */
export class ContentQueue {
  constructor(
    private readonly client: SQSClient,
    private readonly queueUrl: string,
  ) {}

  async enqueuePending(jobs: ContentJob[]): Promise<void> {
    for (const batch of chunk(jobs, SQS_BATCH_LIMIT)) {
      await this.client.send(
        new SendMessageBatchCommand({
          QueueUrl: this.queueUrl,
          Entries: batch.map((job) => ({
            Id: `${job.postId}-${job.lang}`,
            MessageBody: JSON.stringify({ postId: job.postId, lang: job.lang }),
          })),
        }),
      );
    }
  }
}
