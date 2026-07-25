import { ConditionalCheckFailedException, DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { BatchGetCommand, DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { chunk } from '../util/chunk';

export function createDynamoClient(): DynamoDBDocumentClient {
  const client = new DynamoDBClient({});
  return DynamoDBDocumentClient.from(client, {
    marshallOptions: { removeUndefinedValues: true },
  });
}

/**
 * BatchGets `inputs` from `tableName` in chunks of `chunkSize` (DynamoDB's
 * BatchGetItem caps at 100 keys per call), deriving each request key via
 * `toKey`. Shared by every repo that resolves a list of ids into records.
 */
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

/**
 * Runs a conditional DynamoDB write and reports whether the condition held:
 * `true` when the write applied, `false` when DynamoDB rejected it with a
 * ConditionalCheckFailedException. Any other error is rethrown.
 */
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
