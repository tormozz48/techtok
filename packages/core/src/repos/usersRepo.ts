import { ConditionalCheckFailedException } from '@aws-sdk/client-dynamodb';
import { DeleteCommand, type DynamoDBDocumentClient, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import type { Language, Topic } from '@techtok/shared';
import type { Entitlement, Quota } from '../entitlement/entitlement.types';
import { localDayKey } from '../entitlement/quota';
import type { UserRecord } from '../users.types';

type QuotaField = 'cardReads' | 'readerOpens';

export interface TouchOptions {
  readonly deviceLanguage?: Language;
  readonly timezone?: string;
  readonly email?: string;
  readonly name?: string;
}

export class UsersRepo {
  constructor(
    private readonly client: DynamoDBDocumentClient,
    private readonly tableName: string,
  ) {}

  async touch(userId: string, opts: TouchOptions = {}): Promise<UserRecord> {
    const now = new Date().toISOString();
    const setClauses = [
      'createdAt = if_not_exists(createdAt, :now)',
      'lastSeenAt = :now',
      'topics = if_not_exists(topics, :emptyTopics)',
      '#language = if_not_exists(#language, :language)',
      '#timezone = if_not_exists(#timezone, :timezone)',
    ];
    const names: Record<string, string> = { '#language': 'language', '#timezone': 'timezone' };
    const values: Record<string, unknown> = {
      ':now': now,
      ':emptyTopics': [],
      ':language': opts.deviceLanguage ?? 'en',
      ':timezone': opts.timezone ?? 'UTC',
    };

    if (opts.email !== undefined) {
      setClauses.push('email = :email');
      values[':email'] = opts.email;
    }
    if (opts.name !== undefined) {
      setClauses.push('#name = :name');
      names['#name'] = 'name';
      values[':name'] = opts.name;
    }

    const result = await this.client.send(
      new UpdateCommand({
        TableName: this.tableName,
        Key: { userId },
        UpdateExpression: `SET ${setClauses.join(', ')}`,
        ExpressionAttributeNames: names,
        ExpressionAttributeValues: values,
        ReturnValues: 'ALL_NEW',
      }),
    );
    return result.Attributes as UserRecord;
  }

  async deleteUser(userId: string): Promise<void> {
    await this.client.send(new DeleteCommand({ TableName: this.tableName, Key: { userId } }));
  }

  async grantEntitlement(userId: string, entitlement: Entitlement): Promise<UserRecord> {
    const result = await this.client.send(
      new UpdateCommand({
        TableName: this.tableName,
        Key: { userId },
        UpdateExpression: 'SET #entitlement = :entitlement',
        ExpressionAttributeNames: { '#entitlement': 'entitlement' },
        ExpressionAttributeValues: { ':entitlement': entitlement },
        ReturnValues: 'ALL_NEW',
      }),
    );
    return result.Attributes as UserRecord;
  }

  async incrementQuota(
    userId: string,
    field: QuotaField,
    timezone: string,
    by = 1,
  ): Promise<Quota> {
    const today = localDayKey(timezone);

    const tryIncrement = () =>
      this.client.send(
        new UpdateCommand({
          TableName: this.tableName,
          Key: { userId },
          UpdateExpression: 'SET #quota.#field = #quota.#field + :by',
          ConditionExpression: '#quota.#day = :today',
          ExpressionAttributeNames: { '#quota': 'quota', '#field': field, '#day': 'day' },
          ExpressionAttributeValues: { ':by': by, ':today': today },
          ReturnValues: 'ALL_NEW',
        }),
      );

    try {
      const result = await tryIncrement();
      return result.Attributes?.quota as Quota;
    } catch (err) {
      if (!(err instanceof ConditionalCheckFailedException)) throw err;
    }

    const freshQuota: Quota = {
      day: today,
      cardReads: field === 'cardReads' ? by : 0,
      readerOpens: field === 'readerOpens' ? by : 0,
    };
    try {
      const result = await this.client.send(
        new UpdateCommand({
          TableName: this.tableName,
          Key: { userId },
          UpdateExpression: 'SET #quota = :freshQuota',
          ConditionExpression: 'attribute_not_exists(#quota) OR #quota.#day <> :today',
          ExpressionAttributeNames: { '#quota': 'quota', '#day': 'day' },
          ExpressionAttributeValues: { ':freshQuota': freshQuota, ':today': today },
          ReturnValues: 'ALL_NEW',
        }),
      );
      return result.Attributes?.quota as Quota;
    } catch (err) {
      if (!(err instanceof ConditionalCheckFailedException)) throw err;
      const result = await tryIncrement();
      return result.Attributes?.quota as Quota;
    }
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
          'SET #language = :language, lastSeenAt = :now, createdAt = if_not_exists(createdAt, :now), topics = if_not_exists(topics, :emptyTopics)',
        ExpressionAttributeNames: { '#language': 'language' },
        ExpressionAttributeValues: { ':language': language, ':now': now, ':emptyTopics': [] },
        ReturnValues: 'ALL_NEW',
      }),
    );
    return result.Attributes as UserRecord;
  }

  async updateMutedSources(userId: string, mutedSources: string[]): Promise<UserRecord> {
    const now = new Date().toISOString();
    const result = await this.client.send(
      new UpdateCommand({
        TableName: this.tableName,
        Key: { userId },
        UpdateExpression:
          'SET mutedSources = :mutedSources, lastSeenAt = :now, createdAt = if_not_exists(createdAt, :now), topics = if_not_exists(topics, :emptyTopics)',
        ExpressionAttributeValues: {
          ':mutedSources': mutedSources,
          ':now': now,
          ':emptyTopics': [],
        },
        ReturnValues: 'ALL_NEW',
      }),
    );
    return result.Attributes as UserRecord;
  }

  async addTopicReads(userId: string, counts: Partial<Record<Topic, number>>): Promise<void> {
    const entries = Object.entries(counts) as [Topic, number][];
    if (entries.length === 0) return;

    await this.client.send(
      new UpdateCommand({
        TableName: this.tableName,
        Key: { userId },
        UpdateExpression: 'SET #topicReads = if_not_exists(#topicReads, :empty)',
        ExpressionAttributeNames: { '#topicReads': 'topicReads' },
        ExpressionAttributeValues: { ':empty': {} },
      }),
    );

    const names: Record<string, string> = { '#topicReads': 'topicReads' };
    const values: Record<string, number> = {};
    const setClauses = entries.map(([topic, count], i) => {
      const topicAlias = `#t${i}`;
      const zeroValue = `:zero${i}`;
      const countValue = `:n${i}`;
      names[topicAlias] = topic;
      values[zeroValue] = 0;
      values[countValue] = count;
      return `#topicReads.${topicAlias} = if_not_exists(#topicReads.${topicAlias}, ${zeroValue}) + ${countValue}`;
    });

    await this.client.send(
      new UpdateCommand({
        TableName: this.tableName,
        Key: { userId },
        UpdateExpression: `SET ${setClauses.join(', ')}`,
        ExpressionAttributeNames: names,
        ExpressionAttributeValues: values,
      }),
    );
  }
}
