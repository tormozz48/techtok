import { PutObjectCommand, type S3Client } from '@aws-sdk/client-s3';

export interface RawArticleStore {
  archiveRaw(postId: string, html: string): Promise<void>;
}

export function createRawArticleStore(client: S3Client, bucketName: string): RawArticleStore {
  return {
    async archiveRaw(postId: string, html: string): Promise<void> {
      await client.send(
        new PutObjectCommand({
          Bucket: bucketName,
          Key: `raw/${postId}.html`,
          Body: html,
          ContentType: 'text/html',
        }),
      );
    },
  };
}
