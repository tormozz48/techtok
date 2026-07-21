import { SendMessageBatchCommand, type SQSClient } from '@aws-sdk/client-sqs';
import type { NewPost } from '../posts/types';
import { chunk } from '../util/chunk';

const SQS_BATCH_LIMIT = 10;

export class TransformQueue {
  constructor(
    private readonly client: SQSClient,
    private readonly queueUrl: string,
  ) {}

  async enqueueNew(posts: NewPost[]): Promise<void> {
    for (const batch of chunk(posts, SQS_BATCH_LIMIT)) {
      await this.client.send(
        new SendMessageBatchCommand({
          QueueUrl: this.queueUrl,
          Entries: batch.map((post) => ({
            Id: post.postId,
            MessageBody: JSON.stringify({ postId: post.postId, url: post.url }),
          })),
        }),
      );
    }
  }
}
