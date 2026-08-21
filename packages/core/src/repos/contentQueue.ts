import type { SQSClient } from '@aws-sdk/client-sqs';
import type { Language } from '@techtok/shared';
import { sendBatched } from './batchedSqsSend';

export interface ContentJob {
  readonly postId: string;
  readonly lang: Language;
}

export class ContentQueue {
  constructor(
    private readonly client: SQSClient,
    private readonly queueUrl: string,
  ) {}

  async enqueuePending(jobs: ContentJob[]): Promise<void> {
    await sendBatched(this.client, this.queueUrl, jobs, (job) => ({
      id: `${job.postId}-${job.lang}`,
      body: { postId: job.postId, lang: job.lang },
    }));
  }
}
