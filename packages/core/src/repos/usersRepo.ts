import { type DynamoDBDocumentClient, ScanCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import type { Topic } from '@techtok/shared';
import type { UserRecord } from '../users.types';

export class UsersRepo {
  constructor(
    private readonly client: DynamoDBDocumentClient,
    private readonly tableName: string,
  ) {}

  async touch(userId: string): Promise<UserRecord> {
    const now = new Date().toISOString();
    const result = await this.client.send(
      new UpdateCommand({
        TableName: this.tableName,
        Key: { userId },
        UpdateExpression:
          'SET createdAt = if_not_exists(createdAt, :now), lastSeenAt = :now, topics = if_not_exists(topics, :emptyTopics)',
        ExpressionAttributeValues: { ':now': now, ':emptyTopics': [] },
        ReturnValues: 'ALL_NEW',
      }),
    );
    return result.Attributes as UserRecord;
  }

  async updateTopics(userId: string, topics: Topic[]): Promise<UserRecord> {
    const now = new Date().toISOString();
    const result = await this.client.send(
      new UpdateCommand({
        TableName: this.tableName,
        Key: { userId },
        UpdateExpression:
          'SET topics = :topics, lastSeenAt = :now, createdAt = if_not_exists(createdAt, :now)',
        ExpressionAttributeValues: { ':topics': topics, ':now': now },
        ReturnValues: 'ALL_NEW',
      }),
    );
    return result.Attributes as UserRecord;
  }

  async updatePushToken(userId: string, pushToken: string): Promise<UserRecord> {
    const now = new Date().toISOString();
    const result = await this.client.send(
      new UpdateCommand({
        TableName: this.tableName,
        Key: { userId },
        UpdateExpression:
          'SET pushToken = :pushToken, lastSeenAt = :now, createdAt = if_not_exists(createdAt, :now), topics = if_not_exists(topics, :emptyTopics)',
        ExpressionAttributeValues: { ':pushToken': pushToken, ':now': now, ':emptyTopics': [] },
        ReturnValues: 'ALL_NEW',
      }),
    );
    return result.Attributes as UserRecord;
  }

  async listWithPushTokens(): Promise<UserRecord[]> {
    const result = await this.client.send(
      new ScanCommand({
        TableName: this.tableName,
        FilterExpression: 'attribute_exists(pushToken)',
      }),
    );
    return (result.Items ?? []) as UserRecord[];
  }
}
