import { GetObjectCommand, NoSuchKey, PutObjectCommand, type S3Client } from '@aws-sdk/client-s3';
import type { CompactBlock, CompactFigure, Language } from '@techtok/shared';

export interface StoredContent {
  readonly blocks: CompactBlock[];
  readonly figures: CompactFigure[];
}

export class ContentStore {
  constructor(
    private readonly client: S3Client,
    private readonly bucketName: string,
  ) {}

  private key(objectKey: string, lang: Language): string {
    return `content/${objectKey}/${lang}.json`;
  }

  async getContent(objectKey: string, lang: Language): Promise<StoredContent | undefined> {
    try {
      const result = await this.client.send(
        new GetObjectCommand({ Bucket: this.bucketName, Key: this.key(objectKey, lang) }),
      );
      const text = await result.Body?.transformToString();
      return text ? (JSON.parse(text) as StoredContent) : undefined;
    } catch (err) {
      if (err instanceof NoSuchKey) {
        return undefined;
      }
      throw err;
    }
  }

  async putContent(objectKey: string, lang: Language, content: StoredContent): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucketName,
        Key: this.key(objectKey, lang),
        Body: JSON.stringify(content),
        ContentType: 'application/json',
      }),
    );
  }
}
