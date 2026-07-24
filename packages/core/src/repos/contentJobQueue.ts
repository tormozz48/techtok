import { SendMessageCommand, type SQSClient } from '@aws-sdk/client-sqs';
import type { Language } from '@techtok/shared';

export interface ContentJob {
  readonly jobId: string;
  readonly postId: string;
  readonly lang: Language;
}

export class ContentJobQueue {
  constructor(
    private readonly client: SQSClient,
    private readonly queueUrl: string,
  ) {}

  /** One job per `POST` request — unlike `TransformQueue`/`TranslateQueue`,
   * there's never a batch to fan out here. */
  async enqueue(job: ContentJob): Promise<void> {
    await this.client.send(
      new SendMessageCommand({
        QueueUrl: this.queueUrl,
        MessageBody: JSON.stringify(job),
      }),
    );
  }
}
