import type { SQSClient } from '@aws-sdk/client-sqs';
import type { CreatedPost } from '../posts.types';
import { sendBatched } from './batchedSqsSend';

export class TransformQueue {
  constructor(
    private readonly client: SQSClient,
    private readonly queueUrl: string,
  ) {}

  async enqueueNew(posts: CreatedPost[]): Promise<void> {
    await sendBatched(this.client, this.queueUrl, posts, (post) => ({
      id: post.postId,
      body: { postId: post.postId, url: post.url },
    }));
  }
}
