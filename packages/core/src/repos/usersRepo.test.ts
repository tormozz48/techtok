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
