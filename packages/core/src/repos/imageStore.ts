import { PutObjectCommand, type S3Client } from '@aws-sdk/client-s3';

function extensionFor(contentType: string): string {
  const subtype = contentType.split('/')[1]?.split(';')[0];
  return subtype && /^[a-z0-9]+$/i.test(subtype) ? subtype : 'jpg';
}

export class ImageStore {
  constructor(
    private readonly client: S3Client,
    private readonly bucketName: string,
  ) {}

  /** Uploads image bytes and returns the S3 key they were stored under.
   * `suffix` (e.g. `-fig0`) distinguishes multiple images for the same post —
   * the compact reader's mirrored figures (D23) — from the single lead-image
   * key every existing caller still writes to. */
  async putImage(
    postId: string,
    body: Uint8Array,
    contentType: string,
    suffix = '',
  ): Promise<string> {
    const key = `images/${postId}${suffix}.${extensionFor(contentType)}`;
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Body: body,
        ContentType: contentType,
      }),
    );
    return key;
  }
}
