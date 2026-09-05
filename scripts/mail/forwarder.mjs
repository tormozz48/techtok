import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { SESClient, SendRawEmailCommand } from '@aws-sdk/client-ses';
import { buildOversizeNotice, pickFromAddress, rewriteForForwarding } from './rewrite.mjs';

const MAX_FORWARD_BYTES = 9 * 1024 * 1024;

const s3 = new S3Client({});
const ses = new SESClient({});

export const handler = async (event) => {
  const config = readConfig();

  for (const record of event.Records ?? []) {
    const mail = record.ses?.mail;
    const receipt = record.ses?.receipt;
    if (!mail || !receipt) {
      continue;
    }

    if (failedContentScan(receipt)) {
      console.log(
        JSON.stringify({
          messageId: mail.messageId,
          skipped: 'content-scan',
          spam: receipt.spamVerdict?.status,
          virus: receipt.virusVerdict?.status,
        }),
      );
      continue;
    }

    const key = `${config.objectPrefix}${mail.messageId}`;
    const raw = await readRawMessage(config.bucket, key);
    const fromAddress = pickFromAddress(receipt.recipients, config.mailDomain, config.fallbackFrom);

    const outgoing =
      raw.length > MAX_FORWARD_BYTES
        ? buildOversizeNotice({
            fromAddress,
            forwardTo: config.forwardTo,
            originalFrom: (mail.commonHeaders?.from ?? []).join(', '),
            subject: mail.commonHeaders?.subject ?? '(no subject)',
            sizeBytes: raw.length,
            s3Uri: `s3://${config.bucket}/${key}`,
          })
        : rewriteForForwarding({ raw, fromAddress, viaLabel: config.viaLabel });

    await ses.send(
      new SendRawEmailCommand({
        Source: fromAddress,
        Destinations: [config.forwardTo],
        RawMessage: { Data: Buffer.from(outgoing, 'latin1') },
      }),
    );
  }
};

function readConfig() {
  const config = {
    bucket: process.env.MAIL_BUCKET,
    objectPrefix: process.env.MAIL_OBJECT_PREFIX ?? '',
    forwardTo: process.env.MAIL_FORWARD_TO,
    mailDomain: process.env.MAIL_DOMAIN,
    fallbackFrom: process.env.MAIL_FALLBACK_FROM,
    viaLabel: process.env.MAIL_VIA_LABEL ?? 'via TechTok',
  };

  for (const key of ['bucket', 'forwardTo', 'mailDomain', 'fallbackFrom']) {
    if (!config[key]) {
      throw new Error(`Missing required environment variable for ${key}`);
    }
  }

  return config;
}

function failedContentScan(receipt) {
  return receipt.spamVerdict?.status === 'FAIL' || receipt.virusVerdict?.status === 'FAIL';
}

async function readRawMessage(bucket, key) {
  try {
    const object = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
    const bytes = await object.Body.transformToByteArray();
    return Buffer.from(bytes).toString('latin1');
  } catch (error) {
    console.error(JSON.stringify({ failedToRead: `s3://${bucket}/${key}` }));
    throw error;
  }
}
