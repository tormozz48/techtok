import { DynamoDBDocumentClient, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { mockClient } from 'aws-sdk-client-mock';
import { beforeEach, describe, expect, it } from 'vitest';
import { UsersRepo } from './usersRepo';

const ddbMock = mockClient(DynamoDBDocumentClient);
const client = ddbMock as unknown as DynamoDBDocumentClient;

beforeEach(() => {
  ddbMock.reset();
});

describe('usersRepo.touch', () => {
  // `language` is a DynamoDB reserved keyword (confirmed live against real
  // DynamoDB — aws-sdk-client-mock does not simulate this validation, so it
  // slips past a mocked test unless the alias is asserted explicitly; see
  // CLAUDE.md's status log for this exact bug class hitting twice before).
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
    expect(input?.ExpressionAttributeNames).toEqual({ '#language': 'language' });
    expect(input?.ExpressionAttributeValues).toMatchObject({ ':language': 'en' });
  });

  it('seeds language from the device language when given', async () => {
    ddbMock.on(UpdateCommand).resolves({ Attributes: { userId: 'device-1' } });
    const repo = new UsersRepo(client, 'Users');

    await repo.touch('device-1', 'uk');

    const input = ddbMock.commandCalls(UpdateCommand)[0]?.args[0]?.input;
    expect(input?.ExpressionAttributeValues).toMatchObject({ ':language': 'uk' });
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
