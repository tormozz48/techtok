import { PutObjectCommand, type S3Client } from '@aws-sdk/client-s3';

export class RawArticleStore {
  constructor(
    private readonly client: S3Client,
    private readonly bucketName: string,
  ) {}

  async archiveRaw(postId: string, html: string): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucketName,
        Key: `raw/${postId}.html`,
        Body: html,
        ContentType: 'text/html',
      }),
    );
  }
}
