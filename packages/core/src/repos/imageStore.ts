import { PutObjectCommand, type S3Client } from '@aws-sdk/client-s3';

export class ImageStore {
  constructor(
    private readonly client: S3Client,
    private readonly bucketName: string,
  ) {}

  async putImage(
    objectKey: string,
    body: Uint8Array,
    contentType: string,
    suffix = '',
  ): Promise<string> {
    const key = `images/${objectKey}${suffix}.${extensionFor(contentType)}`;
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

function extensionFor(contentType: string): string {
  const subtype = contentType.split('/')[1]?.split(';')[0];
  return subtype && /^[a-z0-9]+$/i.test(subtype) ? subtype : 'jpg';
}
