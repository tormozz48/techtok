import { SendMessageBatchCommand, type SQSClient } from '@aws-sdk/client-sqs';
import { chunk } from '../util/chunk';

const SQS_BATCH_LIMIT = 10;

export async function sendBatched<T>(
  client: SQSClient,
  queueUrl: string,
  items: T[],
  toEntry: (item: T) => { id: string; body: unknown },
): Promise<void> {
  for (const batch of chunk(items, SQS_BATCH_LIMIT)) {
    await client.send(
      new SendMessageBatchCommand({
        QueueUrl: queueUrl,
        Entries: batch.map((item) => {
          const { id, body } = toEntry(item);
          return { Id: id, MessageBody: JSON.stringify(body) };
        }),
      }),
    );
  }
}
