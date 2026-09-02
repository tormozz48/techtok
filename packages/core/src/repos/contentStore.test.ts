import type { GetObjectCommandOutput } from '@aws-sdk/client-s3';
import { GetObjectCommand, NoSuchKey, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { mockClient } from 'aws-sdk-client-mock';
import { beforeEach, describe, expect, it } from 'vitest';
import { ContentStore } from './contentStore';

const s3Mock = mockClient(S3Client);
const client = s3Mock as unknown as S3Client;

beforeEach(() => {
  s3Mock.reset();
});

describe('contentStore.putContent', () => {
  it('writes content under content/<postId>/<lang>.json', async () => {
    s3Mock.on(PutObjectCommand).resolves({});
    const store = new ContentStore(client, 'Content');

    await store.putContent('post1', 'ru', { blocks: [], figures: [] });

    const input = s3Mock.commandCalls(PutObjectCommand)[0]?.args[0]?.input;
    expect(input?.Bucket).toBe('Content');
    expect(input?.Key).toBe('content/post1/ru.json');
    expect(input?.ContentType).toBe('application/json');
  });
});

describe('contentStore.getContent', () => {
  it('reads back stored content from the given key', async () => {
    const stored = { blocks: [{ type: 'paragraph', text: 'hi' }], figures: [] };
    const body = {
      transformToString: async () => JSON.stringify(stored),
    } as GetObjectCommandOutput['Body'];
    s3Mock.on(GetObjectCommand).resolves({ Body: body });
    const store = new ContentStore(client, 'Content');

    const content = await store.getContent('post1', 'ru');

    expect(content).toEqual(stored);
    const input = s3Mock.commandCalls(GetObjectCommand)[0]?.args[0]?.input;
    expect(input).toEqual({ Bucket: 'Content', Key: 'content/post1/ru.json' });
  });

  it('returns undefined when the content object does not exist yet', async () => {
    s3Mock.on(GetObjectCommand).rejects(new NoSuchKey({ message: 'not found', $metadata: {} }));
    const store = new ContentStore(client, 'Content');

    await expect(store.getContent('post1', 'ru')).resolves.toBeUndefined();
  });

  it('propagates a transient read failure instead of reporting it as missing', async () => {
    s3Mock.on(GetObjectCommand).rejects(new Error('ETIMEDOUT'));
    const store = new ContentStore(client, 'Content');

    await expect(store.getContent('post1', 'ru')).rejects.toThrow('ETIMEDOUT');
  });
});
