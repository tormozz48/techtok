import {
  type DynamoDBDocumentClient,
  PutCommand,
  ScanCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';
import type { SourceRecord } from '../sources/types';
import { conditionalWrite } from './dynamoClient';

export interface FetchOutcome {
  status: 'ok' | 'not-modified' | 'error';
  etag?: string;
  lastModified?: string;
}

export interface SourcesRepo {
  listEnabled(): Promise<SourceRecord[]>;
  putIfNew(source: SourceRecord): Promise<boolean>;
  recordFetchResult(sourceId: string, outcome: FetchOutcome): Promise<void>;
}

export function createSourcesRepo(client: DynamoDBDocumentClient, tableName: string): SourcesRepo {
  return {
    async listEnabled(): Promise<SourceRecord[]> {
      const result = await client.send(
        new ScanCommand({
          TableName: tableName,
          FilterExpression: 'enabled = :true',
          ExpressionAttributeValues: { ':true': true },
        }),
      );
      return (result.Items ?? []) as SourceRecord[];
    },

    async putIfNew(source: SourceRecord): Promise<boolean> {
      return conditionalWrite(() =>
        client.send(
          new PutCommand({
            TableName: tableName,
            Item: source,
            ConditionExpression: 'attribute_not_exists(sourceId)',
          }),
        ),
      );
    },

    async recordFetchResult(sourceId: string, outcome: FetchOutcome): Promise<void> {
      const now = new Date().toISOString();

      if (outcome.status === 'error') {
        await client.send(
          new UpdateCommand({
            TableName: tableName,
            Key: { sourceId },
            UpdateExpression: 'SET lastFetchAt = :now, lastStatus = :status ADD failCount :one',
            ExpressionAttributeValues: { ':now': now, ':status': outcome.status, ':one': 1 },
          }),
        );
        return;
      }

      const setParts = ['lastFetchAt = :now', 'lastStatus = :status', 'failCount = :zero'];
      const values: Record<string, unknown> = {
        ':now': now,
        ':status': outcome.status,
        ':zero': 0,
      };
      if (outcome.etag) {
        setParts.push('etag = :etag');
        values[':etag'] = outcome.etag;
      }
      if (outcome.lastModified) {
        setParts.push('lastModified = :lastModified');
        values[':lastModified'] = outcome.lastModified;
      }

      await client.send(
        new UpdateCommand({
          TableName: tableName,
          Key: { sourceId },
          UpdateExpression: `SET ${setParts.join(', ')}`,
          ExpressionAttributeValues: values,
        }),
      );
    },
  };
}
