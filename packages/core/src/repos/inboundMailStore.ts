import { GetObjectCommand, type S3Client } from '@aws-sdk/client-s3';

export class InboundMailStore {
  constructor(
    private readonly client: S3Client,
    private readonly bucketName: string,
    private readonly objectPrefix: string,
  ) {}

  uriFor(messageId: string): string {
    return `s3://${this.bucketName}/${this.keyFor(messageId)}`;
  }

  async getRawMessage(messageId: string): Promise<string> {
    const result = await this.client.send(
      new GetObjectCommand({ Bucket: this.bucketName, Key: this.keyFor(messageId) }),
    );
    const bytes = await result.Body?.transformToByteArray();
    return Buffer.from(bytes ?? []).toString('latin1');
  }

  private keyFor(messageId: string): string {
    return `${this.objectPrefix}${messageId}`;
  }
}
