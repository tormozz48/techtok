import { type DynamoDBDocumentClient, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import type { Topic } from '@techtok/shared';
import type { UserRecord } from '../users/types';

export interface UsersRepo {
  touch(userId: string): Promise<UserRecord>;
  updateTopics(userId: string, topics: Topic[]): Promise<UserRecord>;
}

export function createUsersRepo(client: DynamoDBDocumentClient, tableName: string): UsersRepo {
  return {
    async touch(userId: string): Promise<UserRecord> {
      const now = new Date().toISOString();
      const result = await client.send(
        new UpdateCommand({
          TableName: tableName,
          Key: { userId },
          UpdateExpression:
            'SET createdAt = if_not_exists(createdAt, :now), lastSeenAt = :now, topics = if_not_exists(topics, :emptyTopics)',
          ExpressionAttributeValues: { ':now': now, ':emptyTopics': [] },
          ReturnValues: 'ALL_NEW',
        }),
      );
      return result.Attributes as UserRecord;
    },

    async updateTopics(userId: string, topics: Topic[]): Promise<UserRecord> {
      const now = new Date().toISOString();
      const result = await client.send(
        new UpdateCommand({
          TableName: tableName,
          Key: { userId },
          UpdateExpression:
            'SET topics = :topics, lastSeenAt = :now, createdAt = if_not_exists(createdAt, :now)',
          ExpressionAttributeValues: { ':topics': topics, ':now': now },
          ReturnValues: 'ALL_NEW',
        }),
      );
      return result.Attributes as UserRecord;
    },
  };
}
