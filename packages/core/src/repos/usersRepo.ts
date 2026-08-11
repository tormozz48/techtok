import { DeleteCommand, type DynamoDBDocumentClient, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import type { Language, Topic } from '@techtok/shared';
import type { UserRecord } from '../users.types';

export interface TouchOptions {
  /** Seeds `language` only on a brand-new user (D20's "device-locale default
   * on first sight") — `if_not_exists` never overwrites a language the user
   * already chose. */
  readonly deviceLanguage?: Language;
  /** Seeds `timezone` only on a brand-new user, captured once at sign-in
   * (D68/D69) — never re-derived from later requests. Falls back to UTC. */
  readonly timezone?: string;
  /** From the Google ID token (D68). Kept fresh on every touch (a plain
   * `SET`, not `if_not_exists`) since Google, not this app, is the source of
   * truth for a user's current email/display name. Omitted (not sent as
   * `undefined`) when the token didn't carry the claim. */
  readonly email?: string;
  readonly name?: string;
}

export class UsersRepo {
  constructor(
    private readonly client: DynamoDBDocumentClient,
    private readonly tableName: string,
  ) {}

  /** `language`/`name` are both DynamoDB reserved keywords (confirmed live —
   * the same class of bug this project has hit twice before, see
   * CLAUDE.md), so both are aliased like every other attribute name in this
   * repo, reserved or not. */
  async touch(userId: string, opts: TouchOptions = {}): Promise<UserRecord> {
    const now = new Date().toISOString();
    const setClauses = [
      'createdAt = if_not_exists(createdAt, :now)',
      'lastSeenAt = :now',
      'topics = if_not_exists(topics, :emptyTopics)',
      '#language = if_not_exists(#language, :language)',
      'timezone = if_not_exists(timezone, :timezone)',
    ];
    const names: Record<string, string> = { '#language': 'language' };
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

  /** Deletes the user's profile row (D68's `DELETE /v1/me`, required by Play
   * policy). Deleting `UserActivity` rows is a separate call
   * (`UserActivityRepo.deleteAllForUser`) — different table, different
   * partition scheme. */
  async deleteUser(userId: string): Promise<void> {
    await this.client.send(new DeleteCommand({ TableName: this.tableName, Key: { userId } }));
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

  /** Seeds `topics` on first touch (`if_not_exists`), same as `touch()` —
   * without it, a device that calls this before ever hitting `touch()`
   * (`GET /v1/me`, `GET /v1/feed`, ...) gets a row with no `topics` at all,
   * and `UserRecord.topics`/`meResponseSchema` both treat it as required, so
   * the response fails schema validation and 500s (confirmed live via the
   * e2e mutation suite hitting this route from a brand-new device). */
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

  /** Seeds `topics` on first touch — see `updateLanguage`'s comment. */
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

  /** Increments per-topic read counters (feed affinity signal, scoring.ts).
   * `counts` maps topic -> number of newly-read posts in that topic from a
   * single reads batch. Two sequential updates because DynamoDB's `ADD`
   * cannot target a nested map path (`topicReads.ai`) — the first ensures
   * the map exists, the second increments each topic's counter within it. */
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
