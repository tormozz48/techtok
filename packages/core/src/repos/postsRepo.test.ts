import { ConditionalCheckFailedException } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { mockClient } from 'aws-sdk-client-mock';
import { beforeEach, describe, expect, it } from 'vitest';
import type { NewPost } from '../posts/types';
import { createPostsRepo } from './postsRepo';

const ddbMock = mockClient(DynamoDBDocumentClient);
const client = ddbMock as unknown as DynamoDBDocumentClient;

beforeEach(() => {
  ddbMock.reset();
});

const samplePost: NewPost = {
  postId: 'abc123',
  url: 'https://example.com/a',
  canonicalUrl: 'https://example.com/a',
  sourceId: 'hn',
  sourceName: 'Hacker News',
  origTitle: 'Title',
  cardTitle: 'Title',
  summary: 'Summary',
  excerpt: 'Summary',
  primaryTopic: 'dev',
  topics: ['dev'],
  status: 'ready',
  transform: 'excerpt',
  publishedAt: '2026-07-18T00:00:00.000Z',
};

describe('postsRepo.putIfNew', () => {
  it('writes a conditional put with a 90-day ttl and the byTime gsi key', async () => {
    ddbMock.on(PutCommand).resolves({});
    const repo = createPostsRepo(client, 'Posts');

    const created = await repo.putIfNew(samplePost);

    expect(created).toBe(true);
    const calls = ddbMock.commandCalls(PutCommand);
    expect(calls).toHaveLength(1);
    const input = calls[0]?.args[0]?.input;
    expect(input?.ConditionExpression).toBe('attribute_not_exists(postId)');
    expect(input?.Item?.gsi1pk).toBe('POST');
    expect(typeof input?.Item?.ttl).toBe('number');
  });

  it('returns false without throwing when the post already exists', async () => {
    ddbMock.on(PutCommand).rejects(
      new ConditionalCheckFailedException({
        message: 'The conditional request failed',
        $metadata: {},
      }),
    );
    const repo = createPostsRepo(client, 'Posts');

    await expect(repo.putIfNew(samplePost)).resolves.toBe(false);
  });

  it('rethrows errors that are not a conditional check failure', async () => {
    ddbMock.on(PutCommand).rejects(new Error('boom'));
    const repo = createPostsRepo(client, 'Posts');

    await expect(repo.putIfNew(samplePost)).rejects.toThrow('boom');
  });
});

describe('postsRepo.queryByTopic', () => {
  it('queries the byTopic GSI newest-first', async () => {
    ddbMock.on(QueryCommand).resolves({ Items: [samplePost] });
    const repo = createPostsRepo(client, 'Posts');

    const items = await repo.queryByTopic('dev', { limit: 10 });

    expect(items).toEqual([samplePost]);
    const calls = ddbMock.commandCalls(QueryCommand);
    const input = calls[0]?.args[0]?.input;
    expect(input?.IndexName).toBe('byTopic');
    expect(input?.ScanIndexForward).toBe(false);
    expect(input?.Limit).toBe(10);
    expect(input?.ExpressionAttributeValues).toMatchObject({ ':topic': 'dev' });
  });

  it('adds the before-cursor condition when provided', async () => {
    ddbMock.on(QueryCommand).resolves({ Items: [] });
    const repo = createPostsRepo(client, 'Posts');

    await repo.queryByTopic('science', { before: '2026-07-18T00:00:00.000Z' });

    const input = ddbMock.commandCalls(QueryCommand)[0]?.args[0]?.input;
    expect(input?.KeyConditionExpression).toContain('publishedAt < :before');
    expect(input?.ExpressionAttributeValues).toMatchObject({
      ':before': '2026-07-18T00:00:00.000Z',
    });
  });
});

describe('postsRepo.queryRecent', () => {
  it('queries the byTime GSI with the constant partition key', async () => {
    ddbMock.on(QueryCommand).resolves({ Items: [samplePost] });
    const repo = createPostsRepo(client, 'Posts');

    const items = await repo.queryRecent({ limit: 5 });

    expect(items).toEqual([samplePost]);
    const input = ddbMock.commandCalls(QueryCommand)[0]?.args[0]?.input;
    expect(input?.IndexName).toBe('byTime');
    expect(input?.ExpressionAttributeValues).toMatchObject({ ':pk': 'POST' });
  });

  it('returns an empty array when the query has no items', async () => {
    ddbMock.on(QueryCommand).resolves({});
    const repo = createPostsRepo(client, 'Posts');

    expect(await repo.queryRecent()).toEqual([]);
  });
});
