import { SendMessageBatchCommand, SQSClient } from '@aws-sdk/client-sqs';
import { mockClient } from 'aws-sdk-client-mock';
import { beforeEach, describe, expect, it } from 'vitest';
import type { NewPost } from '../posts/types';
import { createTransformQueue } from './transformQueue';

const sqsMock = mockClient(SQSClient);
const client = sqsMock as unknown as SQSClient;

beforeEach(() => {
  sqsMock.reset();
});

function samplePost(postId: string): NewPost {
  return {
    postId,
    url: `https://example.com/${postId}`,
    canonicalUrl: `https://example.com/${postId}`,
    sourceId: 'hn',
    sourceName: 'Hacker News',
    origTitle: 'Title',
    cardTitle: 'Title',
    summary: 'Summary',
    excerpt: 'Summary',
    primaryTopic: 'dev',
    topics: ['dev'],
    status: 'discovered',
    transform: 'excerpt',
    publishedAt: '2026-07-18T00:00:00.000Z',
  };
}

describe('transformQueue.enqueueNew', () => {
  it('sends a batch with postId/url message bodies', async () => {
    sqsMock.on(SendMessageBatchCommand).resolves({});
    const queue = createTransformQueue(client, 'https://sqs.example/TransformQueue');

    await queue.enqueueNew([samplePost('a'), samplePost('b')]);

    const calls = sqsMock.commandCalls(SendMessageBatchCommand);
    expect(calls).toHaveLength(1);
    const input = calls[0]?.args[0]?.input;
    expect(input?.QueueUrl).toBe('https://sqs.example/TransformQueue');
    expect(input?.Entries).toEqual([
      { Id: 'a', MessageBody: JSON.stringify({ postId: 'a', url: 'https://example.com/a' }) },
      { Id: 'b', MessageBody: JSON.stringify({ postId: 'b', url: 'https://example.com/b' }) },
    ]);
  });

  it('chunks into batches of 10', async () => {
    sqsMock.on(SendMessageBatchCommand).resolves({});
    const queue = createTransformQueue(client, 'https://sqs.example/TransformQueue');
    const posts = Array.from({ length: 15 }, (_, i) => samplePost(`p${i}`));

    await queue.enqueueNew(posts);

    const calls = sqsMock.commandCalls(SendMessageBatchCommand);
    expect(calls).toHaveLength(2);
    expect(calls[0]?.args[0]?.input?.Entries).toHaveLength(10);
    expect(calls[1]?.args[0]?.input?.Entries).toHaveLength(5);
  });
});
