import { ConditionalCheckFailedException } from '@aws-sdk/client-dynamodb';
import { DeleteCommand, type DynamoDBDocumentClient, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import type { Language, Topic } from '@techtok/shared';
import type { Entitlement, Quota } from '../entitlement/entitlement.types';
import { localDayKey } from '../entitlement/quota';
import type { UserRecord } from '../users.types';

type QuotaField = 'cardReads' | 'readerOpens';

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

  /** `language`/`name`/`timezone` are all DynamoDB reserved keywords
   * (confirmed live — the same class of bug this project has hit before, see
   * CLAUDE.md), so all are aliased like every other attribute name in this
   * repo, reserved or not. */
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

  /** Deletes the user's profile row (D68's `DELETE /v1/me`, required by Play
   * policy). Deleting `UserActivity` rows is a separate call
   * (`UserActivityRepo.deleteAllForUser`) — different table, different
   * partition scheme. */
  async deleteUser(userId: string): Promise<void> {
    await this.client.send(new DeleteCommand({ TableName: this.tableName, Key: { userId } }));
  }

  /** Full replace of the `entitlement` map (D70) — grant, revoke, or update
   * in one write, called by both the manual ops-script path and (phase 21)
   * Play's verify callback. `entitlement` isn't a known DynamoDB reserved
   * word, but this file aliases every attribute it touches regardless — see
   * CLAUDE.md's status log for this exact bug class hitting this codebase
   * more than once, always past a mocked test. */
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

  /** Atomic, day-aware quota increment (D69). Deliberately uses a `SET path
   * = path + :by` arithmetic expression, never DynamoDB's `ADD` action on a
   * nested map path — `addTopicReads` below already found live that `ADD`
   * doesn't reach into a nested attribute the way it looks like it should.
   * Two-step optimistic pattern: try the plain increment gated on "today's
   * quota already exists"; a stale/absent quota fails that condition, so
   * fall back to writing a fresh zero-based day; if *that* also loses a
   * race (another request reset the day in between), the plain increment is
   * retried once more, since the day now exists. */
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
      // A concurrent request reset the day between our two attempts above —
      // quota now exists for today, so the plain increment will succeed.
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
