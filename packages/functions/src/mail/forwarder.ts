import { Logger } from '@aws-lambda-powertools/logger';
import {
  buildOversizeNotice,
  createS3Client,
  createSesClient,
  InboundMailStore,
  pickFromAddress,
  RawMailSender,
  rewriteForForwarding,
} from '@techtok/core';
import type { SESHandler, SESReceipt } from 'aws-lambda';
import { requireEnv } from '../env';
import { lazy } from '../lazy';

const MAX_FORWARD_BYTES = 9 * 1024 * 1024;

const logger = new Logger({ serviceName: 'mail-forwarder' });

const getInboundMailStore = lazy(
  () =>
    new InboundMailStore(
      createS3Client(),
      requireEnv('MAIL_BUCKET'),
      requireEnv('MAIL_OBJECT_PREFIX'),
    ),
);

const getRawMailSender = lazy(() => new RawMailSender(createSesClient()));

export const handler: SESHandler = async (event) => {
  const forwardTo = requireEnv('MAIL_FORWARD_TO');
  const mailDomain = requireEnv('MAIL_DOMAIN');
  const fallbackFrom = requireEnv('MAIL_FALLBACK_FROM');
  const viaLabel = requireEnv('MAIL_VIA_LABEL');
  const store = getInboundMailStore();

  for (const record of event.Records) {
    const { mail, receipt } = record.ses;

    if (failedContentScan(receipt)) {
      logger.info('Skipped message that failed a content scan', {
        messageId: mail.messageId,
        spam: receipt.spamVerdict?.status,
        virus: receipt.virusVerdict?.status,
      });
      continue;
    }

    const raw = await readRawMessage(store, mail.messageId);
    const fromAddress = pickFromAddress(receipt.recipients, mailDomain, fallbackFrom);

    const outgoing =
      raw.length > MAX_FORWARD_BYTES
        ? buildOversizeNotice({
            fromAddress,
            forwardTo,
            originalFrom: (mail.commonHeaders?.from ?? []).join(', '),
            subject: mail.commonHeaders?.subject ?? '(no subject)',
            sizeBytes: raw.length,
            s3Uri: store.uriFor(mail.messageId),
          })
        : rewriteForForwarding({ raw, fromAddress, viaLabel });

    await getRawMailSender().send(fromAddress, forwardTo, outgoing);
  }
};

function failedContentScan(receipt: SESReceipt): boolean {
  return receipt.spamVerdict?.status === 'FAIL' || receipt.virusVerdict?.status === 'FAIL';
}

async function readRawMessage(store: InboundMailStore, messageId: string): Promise<string> {
  try {
    return await store.getRawMessage(messageId);
  } catch (error) {
    logger.error('Failed to read the raw inbound message', { s3Uri: store.uriFor(messageId) });
    throw error;
  }
}
