import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { mockClient } from 'aws-sdk-client-mock';
import { beforeEach, describe, expect, it } from 'vitest';
import { ImageStore } from './imageStore';

const s3Mock = mockClient(S3Client);
const client = s3Mock as unknown as S3Client;

beforeEach(() => {
  s3Mock.reset();
});

describe('ImageStore.putImage', () => {
  it('uploads the image bytes and derives the key extension from content-type', async () => {
    s3Mock.on(PutObjectCommand).resolves({});
    const store = new ImageStore(client, 'Images');
    const body = new Uint8Array([1, 2, 3]);

    const key = await store.putImage('post1', body, 'image/png');

    expect(key).toBe('images/post1.png');
    const input = s3Mock.commandCalls(PutObjectCommand)[0]?.args[0]?.input;
    expect(input).toMatchObject({
      Bucket: 'Images',
      Key: 'images/post1.png',
      Body: body,
      ContentType: 'image/png',
    });
  });

  it('falls back to jpg for an unrecognized content-type', async () => {
    s3Mock.on(PutObjectCommand).resolves({});
    const store = new ImageStore(client, 'Images');

    const key = await store.putImage('post1', new Uint8Array(), 'application/octet-stream');

    expect(key).toBe('images/post1.jpg');
  });

  it('applies a suffix to distinguish multiple images for the same post', async () => {
    s3Mock.on(PutObjectCommand).resolves({});
    const store = new ImageStore(client, 'Images');

    const key = await store.putImage('post1', new Uint8Array(), 'image/png', '-fig0');

    expect(key).toBe('images/post1-fig0.png');
  });
});
