import { GetObjectCommand, PutObjectCommand, type S3Client } from '@aws-sdk/client-s3';

export class RawArticleStore {
  constructor(
    private readonly client: S3Client,
    private readonly bucketName: string,
  ) {}

  async archiveRaw(objectKey: string, html: string): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucketName,
        Key: `raw/${objectKey}.html`,
        Body: html,
        ContentType: 'text/html',
      }),
    );
  }

  async getRaw(key: string): Promise<string> {
    const result = await this.client.send(
      new GetObjectCommand({ Bucket: this.bucketName, Key: key }),
    );
    return (await result.Body?.transformToString()) ?? '';
  }
}
