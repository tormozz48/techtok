import { PutObjectCommand, type S3Client } from '@aws-sdk/client-s3';

export interface ImageStore {
  /** Uploads image bytes and returns the S3 key they were stored under. */
  putImage(postId: string, body: Uint8Array, contentType: string): Promise<string>;
}

function extensionFor(contentType: string): string {
  const subtype = contentType.split('/')[1]?.split(';')[0];
  return subtype && /^[a-z0-9]+$/i.test(subtype) ? subtype : 'jpg';
}

export function createImageStore(client: S3Client, bucketName: string): ImageStore {
  return {
    async putImage(postId: string, body: Uint8Array, contentType: string): Promise<string> {
      const key = `images/${postId}.${extensionFor(contentType)}`;
      await client.send(
        new PutObjectCommand({
          Bucket: bucketName,
          Key: key,
          Body: body,
          ContentType: contentType,
        }),
      );
      return key;
    },
  };
}
