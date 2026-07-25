import { SendMessageBatchCommand, SQSClient } from '@aws-sdk/client-sqs';
import { mockClient } from 'aws-sdk-client-mock';
import { beforeEach, describe, expect, it } from 'vitest';
import { type ContentJob, ContentQueue } from './contentQueue';

const sqsMock = mockClient(SQSClient);
const client = sqsMock as unknown as SQSClient;

beforeEach(() => {
  sqsMock.reset();
});

describe('contentQueue.enqueuePending', () => {
  it('sends a batch with postId/lang message bodies', async () => {
    sqsMock.on(SendMessageBatchCommand).resolves({});
    const queue = new ContentQueue(client, 'https://sqs.example/ContentQueue');
    const jobs: ContentJob[] = [
      { postId: 'a', lang: 'en' },
      { postId: 'a', lang: 'ru' },
    ];

    await queue.enqueuePending(jobs);

    const calls = sqsMock.commandCalls(SendMessageBatchCommand);
    expect(calls).toHaveLength(1);
    const input = calls[0]?.args[0]?.input;
    expect(input?.QueueUrl).toBe('https://sqs.example/ContentQueue');
    expect(input?.Entries).toEqual([
      { Id: 'a-en', MessageBody: JSON.stringify({ postId: 'a', lang: 'en' }) },
      { Id: 'a-ru', MessageBody: JSON.stringify({ postId: 'a', lang: 'ru' }) },
    ]);
  });

  it('chunks into batches of 10', async () => {
    sqsMock.on(SendMessageBatchCommand).resolves({});
    const queue = new ContentQueue(client, 'https://sqs.example/ContentQueue');
    const jobs: ContentJob[] = Array.from({ length: 15 }, (_, i) => ({
      postId: `p${i}`,
      lang: 'pl' as const,
    }));

    await queue.enqueuePending(jobs);

    const calls = sqsMock.commandCalls(SendMessageBatchCommand);
    expect(calls).toHaveLength(2);
    expect(calls[0]?.args[0]?.input?.Entries).toHaveLength(10);
    expect(calls[1]?.args[0]?.input?.Entries).toHaveLength(5);
  });
});
