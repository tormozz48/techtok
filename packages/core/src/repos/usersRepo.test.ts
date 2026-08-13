import { ConditionalCheckFailedException } from '@aws-sdk/client-dynamodb';
import { DeleteCommand, DynamoDBDocumentClient, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { mockClient } from 'aws-sdk-client-mock';
import { beforeEach, describe, expect, it } from 'vitest';
import { UsersRepo } from './usersRepo';

const ddbMock = mockClient(DynamoDBDocumentClient);
const client = ddbMock as unknown as DynamoDBDocumentClient;

beforeEach(() => {
  ddbMock.reset();
});

describe('usersRepo.touch', () => {
  // `language`/`timezone` are DynamoDB reserved keywords (confirmed live
  // against real DynamoDB — aws-sdk-client-mock does not simulate this
  // validation, so it slips past a mocked test unless the alias is asserted
  // explicitly; see CLAUDE.md's status log for this exact bug class hitting
  // multiple times before).
  it('upserts createdAt/topics only if absent and always bumps lastSeenAt', async () => {
    ddbMock.on(UpdateCommand).resolves({
      Attributes: { userId: 'device-1', topics: [], createdAt: 'x', lastSeenAt: 'y' },
    });
    const repo = new UsersRepo(client, 'Users');

    const user = await repo.touch('device-1');

    expect(user.userId).toBe('device-1');
    const input = ddbMock.commandCalls(UpdateCommand)[0]?.args[0]?.input;
    expect(input?.Key).toEqual({ userId: 'device-1' });
    expect(input?.UpdateExpression).toContain('if_not_exists(createdAt, :now)');
    expect(input?.UpdateExpression).toContain('lastSeenAt = :now');
    expect(input?.UpdateExpression).toContain('if_not_exists(topics, :emptyTopics)');
    expect(input?.UpdateExpression).toContain('#language = if_not_exists(#language, :language)');
    expect(input?.UpdateExpression).toContain('#timezone = if_not_exists(#timezone, :timezone)');
    expect(input?.ExpressionAttributeNames).toEqual({
      '#language': 'language',
      '#timezone': 'timezone',
    });
    expect(input?.ExpressionAttributeValues).toMatchObject({
      ':language': 'en',
      ':timezone': 'UTC',
    });
  });

  it('seeds language and timezone from the given opts', async () => {
    ddbMock.on(UpdateCommand).resolves({ Attributes: { userId: 'device-1' } });
    const repo = new UsersRepo(client, 'Users');

    await repo.touch('device-1', { deviceLanguage: 'uk', timezone: 'Europe/Kyiv' });

    const input = ddbMock.commandCalls(UpdateCommand)[0]?.args[0]?.input;
    expect(input?.ExpressionAttributeValues).toMatchObject({
      ':language': 'uk',
      ':timezone': 'Europe/Kyiv',
    });
  });

  // D68: email/name come from the Google ID token and are kept fresh on
  // every touch, unlike language/timezone's if_not_exists seed-once shape.
  it('sets email/name unconditionally (not if_not_exists) when given', async () => {
    ddbMock.on(UpdateCommand).resolves({ Attributes: { userId: 'device-1' } });
    const repo = new UsersRepo(client, 'Users');

    await repo.touch('device-1', { email: 'ada@example.com', name: 'Ada' });

    const input = ddbMock.commandCalls(UpdateCommand)[0]?.args[0]?.input;
    expect(input?.UpdateExpression).toContain('email = :email');
    expect(input?.UpdateExpression).toContain('#name = :name');
    expect(input?.ExpressionAttributeNames).toMatchObject({ '#name': 'name' });
    expect(input?.ExpressionAttributeValues).toMatchObject({
      ':email': 'ada@example.com',
      ':name': 'Ada',
    });
  });

  it('omits email/name from the update entirely when not given', async () => {
    ddbMock.on(UpdateCommand).resolves({ Attributes: { userId: 'device-1' } });
    const repo = new UsersRepo(client, 'Users');

    await repo.touch('device-1');

    const input = ddbMock.commandCalls(UpdateCommand)[0]?.args[0]?.input;
    expect(input?.UpdateExpression).not.toContain('email');
    expect(input?.UpdateExpression).not.toContain('#name');
    expect(input?.ExpressionAttributeValues).not.toHaveProperty(':email');
    expect(input?.ExpressionAttributeValues).not.toHaveProperty(':name');
  });
});

describe('usersRepo.deleteUser', () => {
  it('deletes the user row by userId', async () => {
    ddbMock.on(DeleteCommand).resolves({});
    const repo = new UsersRepo(client, 'Users');

    await repo.deleteUser('device-1');

    const input = ddbMock.commandCalls(DeleteCommand)[0]?.args[0]?.input;
    expect(input?.TableName).toBe('Users');
    expect(input?.Key).toEqual({ userId: 'device-1' });
  });
});

describe('usersRepo.updateTopics', () => {
  it('sets the topics list and bumps lastSeenAt', async () => {
    ddbMock.on(UpdateCommand).resolves({
      Attributes: { userId: 'device-1', topics: ['ai', 'dev'], createdAt: 'x', lastSeenAt: 'y' },
    });
    const repo = new UsersRepo(client, 'Users');

    const user = await repo.updateTopics('device-1', ['ai', 'dev']);

    expect(user.topics).toEqual(['ai', 'dev']);
    const input = ddbMock.commandCalls(UpdateCommand)[0]?.args[0]?.input;
    expect(input?.ExpressionAttributeValues).toMatchObject({ ':topics': ['ai', 'dev'] });
  });
});

describe('usersRepo.updateLanguage', () => {
  it('sets the aliased language attribute and bumps lastSeenAt', async () => {
    ddbMock.on(UpdateCommand).resolves({ Attributes: { userId: 'device-1', language: 'pl' } });
    const repo = new UsersRepo(client, 'Users');

    const user = await repo.updateLanguage('device-1', 'pl');

    expect(user).toEqual({ userId: 'device-1', language: 'pl' });
    const input = ddbMock.commandCalls(UpdateCommand)[0]?.args[0]?.input;
    expect(input?.Key).toEqual({ userId: 'device-1' });
    expect(input?.UpdateExpression).toContain('#language = :language');
    expect(input?.ExpressionAttributeNames).toEqual({ '#language': 'language' });
    expect(input?.ExpressionAttributeValues).toMatchObject({ ':language': 'pl' });
  });

  // A device that never hit touch() first (GET /v1/me, GET /v1/feed, ...)
  // otherwise gets a row with no `topics` at all — UserRecord.topics and
  // meResponseSchema both treat it as required, so the response 500s. This
  // was caught live by the e2e mutation suite against a brand-new device.
  it('seeds topics to an empty array if_not_exists, same as touch()', async () => {
    ddbMock.on(UpdateCommand).resolves({ Attributes: { userId: 'device-1', language: 'pl' } });
    const repo = new UsersRepo(client, 'Users');

    await repo.updateLanguage('device-1', 'pl');

    const input = ddbMock.commandCalls(UpdateCommand)[0]?.args[0]?.input;
    expect(input?.UpdateExpression).toContain('topics = if_not_exists(topics, :emptyTopics)');
    expect(input?.ExpressionAttributeValues).toMatchObject({ ':emptyTopics': [] });
  });
});

describe('usersRepo.updateMutedSources', () => {
  it('sets the mutedSources list (full replace) and bumps lastSeenAt', async () => {
    ddbMock.on(UpdateCommand).resolves({
      Attributes: { userId: 'device-1', mutedSources: ['hn'], createdAt: 'x', lastSeenAt: 'y' },
    });
    const repo = new UsersRepo(client, 'Users');

    const user = await repo.updateMutedSources('device-1', ['hn']);

    expect(user.mutedSources).toEqual(['hn']);
    const input = ddbMock.commandCalls(UpdateCommand)[0]?.args[0]?.input;
    expect(input?.Key).toEqual({ userId: 'device-1' });
    expect(input?.ExpressionAttributeValues).toMatchObject({ ':mutedSources': ['hn'] });
  });

  it('accepts an empty array to unmute everything', async () => {
    ddbMock.on(UpdateCommand).resolves({
      Attributes: { userId: 'device-1', mutedSources: [], createdAt: 'x', lastSeenAt: 'y' },
    });
    const repo = new UsersRepo(client, 'Users');

    const user = await repo.updateMutedSources('device-1', []);

    expect(user.mutedSources).toEqual([]);
    const input = ddbMock.commandCalls(UpdateCommand)[0]?.args[0]?.input;
    expect(input?.ExpressionAttributeValues).toMatchObject({ ':mutedSources': [] });
  });

  // Same rationale as updateLanguage's — see that test's comment.
  it('seeds topics to an empty array if_not_exists, same as touch()', async () => {
    ddbMock.on(UpdateCommand).resolves({
      Attributes: { userId: 'device-1', mutedSources: ['hn'], createdAt: 'x', lastSeenAt: 'y' },
    });
    const repo = new UsersRepo(client, 'Users');

    await repo.updateMutedSources('device-1', ['hn']);

    const input = ddbMock.commandCalls(UpdateCommand)[0]?.args[0]?.input;
    expect(input?.UpdateExpression).toContain('topics = if_not_exists(topics, :emptyTopics)');
    expect(input?.ExpressionAttributeValues).toMatchObject({ ':emptyTopics': [] });
  });
});

describe('usersRepo.addTopicReads', () => {
  it('does nothing when given an empty counts object', async () => {
    ddbMock.on(UpdateCommand).resolves({});
    const repo = new UsersRepo(client, 'Users');

    await repo.addTopicReads('device-1', {});

    expect(ddbMock.commandCalls(UpdateCommand)).toHaveLength(0);
  });

  it('sends an init-the-map update followed by an aliased per-topic increment', async () => {
    ddbMock.on(UpdateCommand).resolves({});
    const repo = new UsersRepo(client, 'Users');

    await repo.addTopicReads('device-1', { ai: 2, dev: 1 });

    const calls = ddbMock.commandCalls(UpdateCommand);
    expect(calls).toHaveLength(2);

    const initInput = calls[0]?.args[0]?.input;
    expect(initInput?.Key).toEqual({ userId: 'device-1' });
    expect(initInput?.UpdateExpression).toBe(
      'SET #topicReads = if_not_exists(#topicReads, :empty)',
    );
    expect(initInput?.ExpressionAttributeNames).toEqual({ '#topicReads': 'topicReads' });
    expect(initInput?.ExpressionAttributeValues).toEqual({ ':empty': {} });

    const incrementInput = calls[1]?.args[0]?.input;
    expect(incrementInput?.Key).toEqual({ userId: 'device-1' });
    // Reserved-word-alias convention: every topic name is aliased, not
    // interpolated raw, even though topic names like "ai"/"dev" aren't
    // themselves reserved words.
    expect(incrementInput?.ExpressionAttributeNames).toEqual({
      '#topicReads': 'topicReads',
      '#t0': 'ai',
      '#t1': 'dev',
    });
    expect(incrementInput?.UpdateExpression).toBe(
      'SET #topicReads.#t0 = if_not_exists(#topicReads.#t0, :zero0) + :n0, ' +
        '#topicReads.#t1 = if_not_exists(#topicReads.#t1, :zero1) + :n1',
    );
    expect(incrementInput?.ExpressionAttributeValues).toEqual({
      ':zero0': 0,
      ':n0': 2,
      ':zero1': 0,
      ':n1': 1,
    });
  });
});

describe('usersRepo.grantEntitlement', () => {
  it('sets the whole entitlement map via an aliased attribute name', async () => {
    const entitlement = {
      plan: 'plus' as const,
      source: 'manual' as const,
      verifiedAt: '2026-08-12T00:00:00.000Z',
    };
    ddbMock.on(UpdateCommand).resolves({ Attributes: { userId: 'device-1', entitlement } });
    const repo = new UsersRepo(client, 'Users');

    const user = await repo.grantEntitlement('device-1', entitlement);

    expect(user.entitlement).toEqual(entitlement);
    const input = ddbMock.commandCalls(UpdateCommand)[0]?.args[0]?.input;
    expect(input?.Key).toEqual({ userId: 'device-1' });
    expect(input?.UpdateExpression).toBe('SET #entitlement = :entitlement');
    expect(input?.ExpressionAttributeNames).toEqual({ '#entitlement': 'entitlement' });
    expect(input?.ExpressionAttributeValues).toEqual({ ':entitlement': entitlement });
  });
});

describe('usersRepo.incrementQuota', () => {
  it('increments the field in place when the stored day already matches today', async () => {
    const quota = { day: '2026-08-12', cardReads: 13, readerOpens: 2 };
    ddbMock.on(UpdateCommand).resolves({ Attributes: { userId: 'device-1', quota } });
    const repo = new UsersRepo(client, 'Users');

    const result = await repo.incrementQuota('device-1', 'cardReads', 'UTC');

    expect(result).toEqual(quota);
    expect(ddbMock.commandCalls(UpdateCommand)).toHaveLength(1);
    const input = ddbMock.commandCalls(UpdateCommand)[0]?.args[0]?.input;
    expect(input?.UpdateExpression).toBe('SET #quota.#field = #quota.#field + :by');
    expect(input?.ConditionExpression).toBe('#quota.#day = :today');
    expect(input?.ExpressionAttributeNames).toEqual({
      '#quota': 'quota',
      '#field': 'cardReads',
      '#day': 'day',
    });
    expect(input?.ExpressionAttributeValues).toMatchObject({ ':by': 1 });
  });

  it('supports incrementing by more than one (a reads batch with several new posts)', async () => {
    ddbMock.on(UpdateCommand).resolves({ Attributes: { userId: 'device-1', quota: {} } });
    const repo = new UsersRepo(client, 'Users');

    await repo.incrementQuota('device-1', 'cardReads', 'UTC', 5);

    const input = ddbMock.commandCalls(UpdateCommand)[0]?.args[0]?.input;
    expect(input?.ExpressionAttributeValues).toMatchObject({ ':by': 5 });
  });

  it('resets to a fresh day when the stored quota is stale, without ever using ADD on the nested path', async () => {
    ddbMock
      .on(UpdateCommand)
      .rejectsOnce(new ConditionalCheckFailedException({ message: 'stale day', $metadata: {} }))
      .resolvesOnce({
        Attributes: {
          userId: 'device-1',
          quota: { day: '2026-08-12', cardReads: 1, readerOpens: 0 },
        },
      });
    const repo = new UsersRepo(client, 'Users');

    const result = await repo.incrementQuota('device-1', 'cardReads', 'UTC');

    expect(result).toEqual({ day: '2026-08-12', cardReads: 1, readerOpens: 0 });
    const calls = ddbMock.commandCalls(UpdateCommand);
    expect(calls).toHaveLength(2);
    expect(calls[1]?.args[0]?.input.UpdateExpression).toBe('SET #quota = :freshQuota');
    expect(calls[1]?.args[0]?.input.ConditionExpression).toBe(
      'attribute_not_exists(#quota) OR #quota.#day <> :today',
    );
  });

  it('seeds the fresh day with the other field at zero, not carried over', async () => {
    ddbMock
      .on(UpdateCommand)
      .rejectsOnce(new ConditionalCheckFailedException({ message: 'stale day', $metadata: {} }))
      .resolvesOnce({ Attributes: { userId: 'device-1', quota: {} } });
    const repo = new UsersRepo(client, 'Users');

    await repo.incrementQuota('device-1', 'readerOpens', 'UTC');

    const freshQuota =
      ddbMock.commandCalls(UpdateCommand)[1]?.args[0]?.input.ExpressionAttributeValues?.[
        ':freshQuota'
      ];
    expect(freshQuota).toEqual({ day: expect.any(String), cardReads: 0, readerOpens: 1 });
  });

  it('retries the plain increment once when a concurrent request already reset the day', async () => {
    ddbMock
      .on(UpdateCommand)
      .rejectsOnce(new ConditionalCheckFailedException({ message: 'stale day', $metadata: {} }))
      .rejectsOnce(
        new ConditionalCheckFailedException({ message: 'day already reset', $metadata: {} }),
      )
      .resolvesOnce({
        Attributes: {
          userId: 'device-1',
          quota: { day: '2026-08-12', cardReads: 6, readerOpens: 0 },
        },
      });
    const repo = new UsersRepo(client, 'Users');

    const result = await repo.incrementQuota('device-1', 'cardReads', 'UTC');

    expect(result).toEqual({ day: '2026-08-12', cardReads: 6, readerOpens: 0 });
    expect(ddbMock.commandCalls(UpdateCommand)).toHaveLength(3);
  });

  it('rethrows an unrelated error instead of swallowing it as a stale-day condition', async () => {
    ddbMock.on(UpdateCommand).rejects(new Error('DynamoDB is on fire'));
    const repo = new UsersRepo(client, 'Users');

    await expect(repo.incrementQuota('device-1', 'cardReads', 'UTC')).rejects.toThrow(
      'DynamoDB is on fire',
    );
  });
});
