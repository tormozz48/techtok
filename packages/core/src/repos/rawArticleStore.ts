import { GetObjectCommand, PutObjectCommand, type S3Client } from '@aws-sdk/client-s3';

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

  /** Reads back a previously-archived page (image backfill, phase 7 task 3).
   * Throws on any failure (missing key, past its 90-day lifecycle, S3
   * outage) — the caller decides how to degrade, same as every other S3/DDB
   * call in this repo layer. */
  async getRaw(key: string): Promise<string> {
    const result = await this.client.send(
      new GetObjectCommand({ Bucket: this.bucketName, Key: key }),
    );
    return (await result.Body?.transformToString()) ?? '';
  }
}
