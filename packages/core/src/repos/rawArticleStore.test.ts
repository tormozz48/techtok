import type { GetObjectCommandOutput } from '@aws-sdk/client-s3';
import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { mockClient } from 'aws-sdk-client-mock';
import { beforeEach, describe, expect, it } from 'vitest';
import { RawArticleStore } from './rawArticleStore';

const s3Mock = mockClient(S3Client);
const client = s3Mock as unknown as S3Client;

beforeEach(() => {
  s3Mock.reset();
});

describe('rawArticleStore.archiveRaw', () => {
  it('puts the raw html under raw/<postId>.html', async () => {
    s3Mock.on(PutObjectCommand).resolves({});
    const store = new RawArticleStore(client, 'RawArticles');

    await store.archiveRaw('post1', '<html>hi</html>');

    const input = s3Mock.commandCalls(PutObjectCommand)[0]?.args[0]?.input;
    expect(input?.Bucket).toBe('RawArticles');
    expect(input?.Key).toBe('raw/post1.html');
    expect(input?.Body).toBe('<html>hi</html>');
    expect(input?.ContentType).toBe('text/html');
  });
});

describe('rawArticleStore.getRaw', () => {
  it('reads back the archived html from the given key', async () => {
    const body = {
      transformToString: async () => '<html>archived</html>',
    } as GetObjectCommandOutput['Body'];
    s3Mock.on(GetObjectCommand).resolves({ Body: body });
    const store = new RawArticleStore(client, 'RawArticles');

    const html = await store.getRaw('raw/post1.html');

    expect(html).toBe('<html>archived</html>');
    const input = s3Mock.commandCalls(GetObjectCommand)[0]?.args[0]?.input;
    expect(input).toEqual({ Bucket: 'RawArticles', Key: 'raw/post1.html' });
  });

  it('propagates a missing-key failure instead of swallowing it', async () => {
    s3Mock.on(GetObjectCommand).rejects(new Error('NoSuchKey'));
    const store = new RawArticleStore(client, 'RawArticles');

    await expect(store.getRaw('raw/missing.html')).rejects.toThrow('NoSuchKey');
  });
});
