import { SendMessageBatchCommand, type SQSClient } from '@aws-sdk/client-sqs';
import type { NewPost } from '../posts/types';
import { chunk } from '../util/chunk';

const SQS_BATCH_LIMIT = 10;

export interface TransformQueue {
  enqueueNew(posts: NewPost[]): Promise<void>;
}

export function createTransformQueue(client: SQSClient, queueUrl: string): TransformQueue {
  return {
    async enqueueNew(posts: NewPost[]): Promise<void> {
      for (const batch of chunk(posts, SQS_BATCH_LIMIT)) {
        await client.send(
          new SendMessageBatchCommand({
            QueueUrl: queueUrl,
            Entries: batch.map((post) => ({
              Id: post.postId,
              MessageBody: JSON.stringify({ postId: post.postId, url: post.url }),
            })),
          }),
        );
      }
    },
  };
}
