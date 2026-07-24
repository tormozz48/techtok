import { SendMessageCommand, SQSClient } from '@aws-sdk/client-sqs';
import { mockClient } from 'aws-sdk-client-mock';
import { beforeEach, describe, expect, it } from 'vitest';
import { ContentJobQueue } from './contentJobQueue';

const sqsMock = mockClient(SQSClient);
const client = sqsMock as unknown as SQSClient;

beforeEach(() => {
  sqsMock.reset();
});

describe('contentJobQueue.enqueue', () => {
  it('sends a single message with the job body', async () => {
    sqsMock.on(SendMessageCommand).resolves({});
    const queue = new ContentJobQueue(client, 'https://sqs.example/ContentJobQueue');

    await queue.enqueue({ jobId: 'job1', postId: 'post1', lang: 'ru' });

    const calls = sqsMock.commandCalls(SendMessageCommand);
    expect(calls).toHaveLength(1);
    const input = calls[0]?.args[0]?.input;
    expect(input?.QueueUrl).toBe('https://sqs.example/ContentJobQueue');
    expect(input?.MessageBody).toBe(JSON.stringify({ jobId: 'job1', postId: 'post1', lang: 'ru' }));
  });
});
