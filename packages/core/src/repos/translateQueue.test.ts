import { SendMessageBatchCommand, SQSClient } from '@aws-sdk/client-sqs';
import { mockClient } from 'aws-sdk-client-mock';
import { beforeEach, describe, expect, it } from 'vitest';
import { type TranslateJob, TranslateQueue } from './translateQueue';

const sqsMock = mockClient(SQSClient);
const client = sqsMock as unknown as SQSClient;

beforeEach(() => {
  sqsMock.reset();
});

describe('translateQueue.enqueuePending', () => {
  it('sends a batch with postId/lang message bodies', async () => {
    sqsMock.on(SendMessageBatchCommand).resolves({});
    const queue = new TranslateQueue(client, 'https://sqs.example/TranslateQueue');
    const jobs: TranslateJob[] = [
      { postId: 'a', lang: 'ru' },
      { postId: 'b', lang: 'uk' },
    ];

    await queue.enqueuePending(jobs);

    const calls = sqsMock.commandCalls(SendMessageBatchCommand);
    expect(calls).toHaveLength(1);
    const input = calls[0]?.args[0]?.input;
    expect(input?.QueueUrl).toBe('https://sqs.example/TranslateQueue');
    expect(input?.Entries).toEqual([
      { Id: 'a-ru', MessageBody: JSON.stringify({ postId: 'a', lang: 'ru' }) },
      { Id: 'b-uk', MessageBody: JSON.stringify({ postId: 'b', lang: 'uk' }) },
    ]);
  });

  it('chunks into batches of 10', async () => {
    sqsMock.on(SendMessageBatchCommand).resolves({});
    const queue = new TranslateQueue(client, 'https://sqs.example/TranslateQueue');
    const jobs: TranslateJob[] = Array.from({ length: 15 }, (_, i) => ({
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
