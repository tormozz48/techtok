import {
  type DynamoDBDocumentClient,
  PutCommand,
  ScanCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';
import type { SourceRecord } from '../sources/types';
import { conditionalWrite } from './dynamoClient';

export interface FetchOutcome {
  readonly status: 'ok' | 'not-modified' | 'error';
  readonly etag?: string;
  readonly lastModified?: string;
}

export class SourcesRepo {
  constructor(
    private readonly client: DynamoDBDocumentClient,
    private readonly tableName: string,
  ) {}

  async listEnabled(): Promise<SourceRecord[]> {
    const result = await this.client.send(
      new ScanCommand({
        TableName: this.tableName,
        FilterExpression: 'enabled = :true',
        ExpressionAttributeValues: { ':true': true },
      }),
    );
    return (result.Items ?? []) as SourceRecord[];
  }

  async putIfNew(source: SourceRecord): Promise<boolean> {
    return conditionalWrite(() =>
      this.client.send(
        new PutCommand({
          TableName: this.tableName,
          Item: source,
          ConditionExpression: 'attribute_not_exists(sourceId)',
        }),
      ),
    );
  }

  async recordFetchResult(sourceId: string, outcome: FetchOutcome): Promise<void> {
    const now = new Date().toISOString();

    if (outcome.status === 'error') {
      await this.client.send(
        new UpdateCommand({
          TableName: this.tableName,
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

    await this.client.send(
      new UpdateCommand({
        TableName: this.tableName,
        Key: { sourceId },
        UpdateExpression: `SET ${setParts.join(', ')}`,
        ExpressionAttributeValues: values,
      }),
    );
  }
}
