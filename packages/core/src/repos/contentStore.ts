import { GetObjectCommand, PutObjectCommand, type S3Client } from '@aws-sdk/client-s3';
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

  private key(postId: string, lang: Language): string {
    return `content/${postId}/${lang}.json`;
  }

  /** Unlike `RawArticleStore.getRaw` (throws on any failure), a miss here is
   * the expected default state — most (postId, lang) pairs simply haven't
   * been generated yet — so any failure (missing key included) is reported
   * as `undefined`, not thrown. */
  async getContent(postId: string, lang: Language): Promise<StoredContent | undefined> {
    try {
      const result = await this.client.send(
        new GetObjectCommand({ Bucket: this.bucketName, Key: this.key(postId, lang) }),
      );
      const text = await result.Body?.transformToString();
      return text ? (JSON.parse(text) as StoredContent) : undefined;
    } catch {
      return undefined;
    }
  }

  async putContent(postId: string, lang: Language, content: StoredContent): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucketName,
        Key: this.key(postId, lang),
        Body: JSON.stringify(content),
        ContentType: 'application/json',
      }),
    );
  }
}
