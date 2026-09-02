import { ConditionalCheckFailedException, DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { BatchGetCommand, DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { chunk } from '../util/chunk';

export const DYNAMO_BATCH_GET_LIMIT = 100;

export function createDynamoClient(): DynamoDBDocumentClient {
  const client = new DynamoDBClient({});
  return DynamoDBDocumentClient.from(client, {
    marshallOptions: { removeUndefinedValues: true },
  });
}

export async function batchGetChunked<TInput, TItem>(
  client: DynamoDBDocumentClient,
  tableName: string,
  inputs: TInput[],
  toKey: (input: TInput) => Record<string, unknown>,
  chunkSize: number,
): Promise<TItem[]> {
  const items: TItem[] = [];
  for (const batch of chunk(inputs, chunkSize)) {
    const result = await client.send(
      new BatchGetCommand({
        RequestItems: { [tableName]: { Keys: batch.map(toKey) } },
      }),
    );
    items.push(...((result.Responses?.[tableName] ?? []) as TItem[]));
  }
  return items;
}

export async function conditionalWrite(send: () => Promise<unknown>): Promise<boolean> {
  try {
    await send();
    return true;
  } catch (err) {
    if (err instanceof ConditionalCheckFailedException) {
      return false;
    }
    throw err;
  }
}
