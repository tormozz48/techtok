import { type DynamoDBDocumentClient, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import type { Language, Topic } from '@techtok/shared';
import type { UserRecord } from '../users.types';

export class UsersRepo {
  constructor(
    private readonly client: DynamoDBDocumentClient,
    private readonly tableName: string,
  ) {}

  /** `deviceLanguage`, when given, seeds `language` only on a brand-new user
   * (D20's "device-locale default on first sight") — `if_not_exists` never
   * overwrites a language the user already chose. `language` is a DynamoDB
   * reserved keyword (confirmed live — the same class of bug this project
   * has hit twice before, see CLAUDE.md), so it's aliased like every other
   * attribute name in this repo, reserved or not. */
  async touch(userId: string, deviceLanguage?: Language): Promise<UserRecord> {
    const now = new Date().toISOString();
    const result = await this.client.send(
      new UpdateCommand({
        TableName: this.tableName,
        Key: { userId },
        UpdateExpression:
          'SET createdAt = if_not_exists(createdAt, :now), lastSeenAt = :now, topics = if_not_exists(topics, :emptyTopics), #language = if_not_exists(#language, :language)',
        ExpressionAttributeNames: { '#language': 'language' },
        ExpressionAttributeValues: {
          ':now': now,
          ':emptyTopics': [],
          ':language': deviceLanguage ?? 'en',
        },
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

  async updateLanguage(userId: string, language: Language): Promise<UserRecord> {
    const now = new Date().toISOString();
    const result = await this.client.send(
      new UpdateCommand({
        TableName: this.tableName,
        Key: { userId },
        UpdateExpression:
          'SET #language = :language, lastSeenAt = :now, createdAt = if_not_exists(createdAt, :now)',
        ExpressionAttributeNames: { '#language': 'language' },
        ExpressionAttributeValues: { ':language': language, ':now': now },
        ReturnValues: 'ALL_NEW',
      }),
    );
    return result.Attributes as UserRecord;
  }
}
