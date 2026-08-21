import { ConditionalCheckFailedException } from '@aws-sdk/client-dynamodb';
import {
  BatchGetCommand,
  DynamoDBDocumentClient,
  PutCommand,
  QueryCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';
import { mockClient } from 'aws-sdk-client-mock';
import { beforeEach, describe, expect, it } from 'vitest';
import type { NewPost } from '../posts.types';
import { PostsRepo } from './postsRepo';

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
    const repo = new PostsRepo(client, 'Posts');

    const created = await repo.putIfNew(samplePost);

    expect(created).toBe(true);
    const calls = ddbMock.commandCalls(PutCommand);
    expect(calls).toHaveLength(1);
    const input = calls[0]?.args[0]?.input;
    expect(input?.ConditionExpression).toBe('attribute_not_exists(postId)');
    expect(input?.Item?.gsi1pk).toBe('POST');
    expect(typeof input?.Item?.ttl).toBe('number');
  });

  it('seeds an empty i18n map (D21/D27)', async () => {
    ddbMock.on(PutCommand).resolves({});
    const repo = new PostsRepo(client, 'Posts');

    await repo.putIfNew(samplePost);

    const input = ddbMock.commandCalls(PutCommand)[0]?.args[0]?.input;
    expect(input?.Item?.i18n).toEqual({});
  });

  it('seeds an empty compactLangs list (D23)', async () => {
    ddbMock.on(PutCommand).resolves({});
    const repo = new PostsRepo(client, 'Posts');

    await repo.putIfNew(samplePost);

    const input = ddbMock.commandCalls(PutCommand)[0]?.args[0]?.input;
    expect(input?.Item?.compactLangs).toEqual([]);
  });

  it('returns false without throwing when the post already exists', async () => {
    ddbMock.on(PutCommand).rejects(
      new ConditionalCheckFailedException({
        message: 'The conditional request failed',
        $metadata: {},
      }),
    );
    const repo = new PostsRepo(client, 'Posts');

    await expect(repo.putIfNew(samplePost)).resolves.toBe(false);
  });

  it('rethrows errors that are not a conditional check failure', async () => {
    ddbMock.on(PutCommand).rejects(new Error('boom'));
    const repo = new PostsRepo(client, 'Posts');

    await expect(repo.putIfNew(samplePost)).rejects.toThrow('boom');
  });
});

describe('postsRepo.queryByTopic', () => {
  it('queries the byTopic GSI newest-first', async () => {
    ddbMock.on(QueryCommand).resolves({ Items: [samplePost] });
    const repo = new PostsRepo(client, 'Posts');

    const items = await repo.queryByTopic('dev', { limit: 10 });

    expect(items).toEqual([samplePost]);
    const calls = ddbMock.commandCalls(QueryCommand);
    const input = calls[0]?.args[0]?.input;
    expect(input?.IndexName).toBe('byTopic');
    expect(input?.ScanIndexForward).toBe(false);
    expect(input?.Limit).toBe(10);
    expect(input?.ExpressionAttributeNames).toEqual({ '#pk': 'primaryTopic' });
    expect(input?.ExpressionAttributeValues).toMatchObject({ ':pk': 'dev' });
  });

  it('adds the before-cursor condition when provided', async () => {
    ddbMock.on(QueryCommand).resolves({ Items: [] });
    const repo = new PostsRepo(client, 'Posts');

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
    const repo = new PostsRepo(client, 'Posts');

    const items = await repo.queryRecent({ limit: 5 });

    expect(items).toEqual([samplePost]);
    const input = ddbMock.commandCalls(QueryCommand)[0]?.args[0]?.input;
    expect(input?.IndexName).toBe('byTime');
    expect(input?.ExpressionAttributeNames).toEqual({ '#pk': 'gsi1pk' });
    expect(input?.ExpressionAttributeValues).toMatchObject({ ':pk': 'POST' });
  });

  it('returns an empty array when the query has no items', async () => {
    ddbMock.on(QueryCommand).resolves({});
    const repo = new PostsRepo(client, 'Posts');

    expect(await repo.queryRecent()).toEqual([]);
  });
});

describe('postsRepo.getByIds', () => {
  it('returns an empty array without calling DynamoDB when given no ids', async () => {
    const repo = new PostsRepo(client, 'Posts');

    expect(await repo.getByIds([])).toEqual([]);
    expect(ddbMock.commandCalls(BatchGetCommand)).toHaveLength(0);
  });

  it('batch-gets posts by id', async () => {
    ddbMock.on(BatchGetCommand).resolves({ Responses: { Posts: [samplePost] } });
    const repo = new PostsRepo(client, 'Posts');

    const posts = await repo.getByIds(['abc123']);

    expect(posts).toEqual([samplePost]);
    const input = ddbMock.commandCalls(BatchGetCommand)[0]?.args[0]?.input;
    expect(input?.RequestItems?.Posts?.Keys).toEqual([{ postId: 'abc123' }]);
  });

  it('chunks requests into batches of 100 keys', async () => {
    ddbMock.on(BatchGetCommand).resolves({ Responses: { Posts: [] } });
    const repo = new PostsRepo(client, 'Posts');
    const postIds = Array.from({ length: 150 }, (_, i) => `post${i}`);

    await repo.getByIds(postIds);

    const calls = ddbMock.commandCalls(BatchGetCommand);
    expect(calls).toHaveLength(2);
    expect(calls[0]?.args[0]?.input?.RequestItems?.Posts?.Keys).toHaveLength(100);
    expect(calls[1]?.args[0]?.input?.RequestItems?.Posts?.Keys).toHaveLength(50);
  });
});

describe('postsRepo.updateTransform', () => {
  it('aliases every written attribute name via ExpressionAttributeNames', async () => {
    ddbMock.on(UpdateCommand).resolves({});
    const repo = new PostsRepo(client, 'Posts');

    await repo.updateTransform('abc123', {
      status: 'ready',
      transform: 'excerpt',
      excerpt: 'a new excerpt',
      s3RawKey: 'raw/abc123.html',
    });

    const input = ddbMock.commandCalls(UpdateCommand)[0]?.args[0]?.input;
    expect(input?.ExpressionAttributeNames).toEqual({
      '#status': 'status',
      '#transform': 'transform',
      '#excerpt': 'excerpt',
      '#s3RawKey': 's3RawKey',
    });
    expect(input?.UpdateExpression).toContain('#status = :status');
    expect(input?.UpdateExpression).toContain('#transform = :transform');
    expect(input?.ExpressionAttributeValues).toMatchObject({
      ':status': 'ready',
      ':transform': 'excerpt',
      ':excerpt': 'a new excerpt',
      ':s3RawKey': 'raw/abc123.html',
    });
  });

  it('omits optional fields that are not provided', async () => {
    ddbMock.on(UpdateCommand).resolves({});
    const repo = new PostsRepo(client, 'Posts');

    await repo.updateTransform('abc123', { status: 'ready', transform: 'excerpt' });

    const input = ddbMock.commandCalls(UpdateCommand)[0]?.args[0]?.input;
    expect(input?.UpdateExpression).toBe('SET #status = :status, #transform = :transform');
  });

  it('writes the LLM-derived card fields', async () => {
    ddbMock.on(UpdateCommand).resolves({});
    const repo = new PostsRepo(client, 'Posts');

    await repo.updateTransform('abc123', {
      status: 'ready',
      transform: 'llm',
      cardTitle: 'A Punchy Hook Title',
      whyItMatters: 'Because it does.',
      primaryTopic: 'ai',
      topics: ['ai', 'dev'],
      lang: 'en',
    });

    const input = ddbMock.commandCalls(UpdateCommand)[0]?.args[0]?.input;
    expect(input?.ExpressionAttributeNames).toEqual({
      '#status': 'status',
      '#transform': 'transform',
      '#cardTitle': 'cardTitle',
      '#whyItMatters': 'whyItMatters',
      '#primaryTopic': 'primaryTopic',
      '#topics': 'topics',
      '#lang': 'lang',
    });
    expect(input?.UpdateExpression).toContain('#cardTitle = :cardTitle');
    expect(input?.UpdateExpression).toContain('#whyItMatters = :whyItMatters');
    expect(input?.UpdateExpression).toContain('#primaryTopic = :primaryTopic');
    expect(input?.UpdateExpression).toContain('#topics = :topics');
    expect(input?.UpdateExpression).toContain('#lang = :lang');
    expect(input?.ExpressionAttributeValues).toMatchObject({
      ':cardTitle': 'A Punchy Hook Title',
      ':whyItMatters': 'Because it does.',
      ':primaryTopic': 'ai',
      ':topics': ['ai', 'dev'],
      ':lang': 'en',
    });
  });

  it('writes mirroredImageUrl when provided', async () => {
    ddbMock.on(UpdateCommand).resolves({});
    const repo = new PostsRepo(client, 'Posts');

    await repo.updateTransform('abc123', {
      status: 'ready',
      transform: 'llm',
      mirroredImageUrl: 'https://cdn.example.com/images/abc123.jpg',
    });

    const input = ddbMock.commandCalls(UpdateCommand)[0]?.args[0]?.input;
    expect(input?.UpdateExpression).toContain('#mirroredImageUrl = :mirroredImageUrl');
    expect(input?.ExpressionAttributeValues).toMatchObject({
      ':mirroredImageUrl': 'https://cdn.example.com/images/abc123.jpg',
    });
  });

  it('removes imageUrl via a REMOVE clause when clearImageUrl is set (D28)', async () => {
    ddbMock.on(UpdateCommand).resolves({});
    const repo = new PostsRepo(client, 'Posts');

    await repo.updateTransform('abc123', {
      status: 'ready',
      transform: 'excerpt',
      clearImageUrl: true,
    });

    const input = ddbMock.commandCalls(UpdateCommand)[0]?.args[0]?.input;
    expect(input?.UpdateExpression).toBe(
      'SET #status = :status, #transform = :transform REMOVE #imageUrl',
    );
    expect(input?.ExpressionAttributeNames).toEqual({
      '#status': 'status',
      '#transform': 'transform',
      '#imageUrl': 'imageUrl',
    });
    expect(input?.ExpressionAttributeValues).toEqual({
      ':status': 'ready',
      ':transform': 'excerpt',
    });
  });

  it('omits the REMOVE clause when clearImageUrl is not set', async () => {
    ddbMock.on(UpdateCommand).resolves({});
    const repo = new PostsRepo(client, 'Posts');

    await repo.updateTransform('abc123', { status: 'ready', transform: 'excerpt' });

    const input = ddbMock.commandCalls(UpdateCommand)[0]?.args[0]?.input;
    expect(input?.UpdateExpression).not.toContain('REMOVE');
    expect(input?.ExpressionAttributeNames).not.toHaveProperty('#imageUrl');
  });
});

describe('postsRepo.updateMirroredImage', () => {
  it('sets only mirroredImageUrl, aliased, without touching status/transform', async () => {
    ddbMock.on(UpdateCommand).resolves({});
    const repo = new PostsRepo(client, 'Posts');

    await repo.updateMirroredImage('abc123', 'https://cdn.example.com/images/abc123.jpg');

    const input = ddbMock.commandCalls(UpdateCommand)[0]?.args[0]?.input;
    expect(input?.Key).toEqual({ postId: 'abc123' });
    expect(input?.UpdateExpression).toBe('SET #mirroredImageUrl = :mirroredImageUrl');
    expect(input?.ExpressionAttributeNames).toEqual({ '#mirroredImageUrl': 'mirroredImageUrl' });
    expect(input?.ExpressionAttributeValues).toEqual({
      ':mirroredImageUrl': 'https://cdn.example.com/images/abc123.jpg',
    });
  });
});

describe('postsRepo.writeTranslation', () => {
  it('writes the translation under the aliased i18n map', async () => {
    ddbMock.on(UpdateCommand).resolves({});
    const repo = new PostsRepo(client, 'Posts');
    const fields = {
      cardTitle: 'Заголовок',
      summary: 'Краткое содержание.',
      whyItMatters: 'Почему это важно.',
      translatedAt: '2026-07-23T00:00:00.000Z',
    };

    await repo.writeTranslation('abc123', 'ru', fields);

    const input = ddbMock.commandCalls(UpdateCommand)[0]?.args[0]?.input;
    expect(input?.Key).toEqual({ postId: 'abc123' });
    expect(input?.UpdateExpression).toBe('SET #i18n.#lang = :fields');
    expect(input?.ExpressionAttributeNames).toEqual({
      '#i18n': 'i18n',
      '#lang': 'ru',
    });
    expect(input?.ExpressionAttributeValues).toEqual({ ':fields': fields });
  });
});

describe('postsRepo.appendCompactLang', () => {
  it('atomically appends the language under an aliased attribute name', async () => {
    ddbMock.on(UpdateCommand).resolves({});
    const repo = new PostsRepo(client, 'Posts');

    await repo.appendCompactLang('abc123', 'ru');

    const input = ddbMock.commandCalls(UpdateCommand)[0]?.args[0]?.input;
    expect(input?.Key).toEqual({ postId: 'abc123' });
    expect(input?.UpdateExpression).toBe(
      'SET #compactLangs = list_append(if_not_exists(#compactLangs, :empty), :lang)',
    );
    expect(input?.ConditionExpression).toBe(
      'attribute_not_exists(#compactLangs) OR NOT contains(#compactLangs, :langValue)',
    );
    expect(input?.ExpressionAttributeNames).toEqual({ '#compactLangs': 'compactLangs' });
    expect(input?.ExpressionAttributeValues).toEqual({
      ':empty': [],
      ':lang': ['ru'],
      ':langValue': 'ru',
    });
  });

  it('is a harmless no-op when the language is already present', async () => {
    ddbMock.on(UpdateCommand).rejects(
      new ConditionalCheckFailedException({
        message: 'The conditional request failed',
        $metadata: {},
      }),
    );
    const repo = new PostsRepo(client, 'Posts');

    await expect(repo.appendCompactLang('abc123', 'en')).resolves.toBeUndefined();
  });
});

describe('postsRepo.setMirroredFigures', () => {
  it('overwrites the full mirroredFigures list under an aliased attribute name', async () => {
    ddbMock.on(UpdateCommand).resolves({});
    const repo = new PostsRepo(client, 'Posts');
    const figures = [{ url: 'https://cdn.example.com/fig.jpg' }];

    await repo.setMirroredFigures('abc123', figures);

    const input = ddbMock.commandCalls(UpdateCommand)[0]?.args[0]?.input;
    expect(input?.Key).toEqual({ postId: 'abc123' });
    expect(input?.UpdateExpression).toBe('SET #mirroredFigures = :figures');
    expect(input?.ExpressionAttributeNames).toEqual({ '#mirroredFigures': 'mirroredFigures' });
    expect(input?.ExpressionAttributeValues).toEqual({ ':figures': figures });
  });
});

describe('postsRepo.setDuplicateOf', () => {
  it('sets duplicateOf under an aliased attribute name', async () => {
    ddbMock.on(UpdateCommand).resolves({});
    const repo = new PostsRepo(client, 'Posts');

    await repo.setDuplicateOf('abc123', 'root-post-id');

    const input = ddbMock.commandCalls(UpdateCommand)[0]?.args[0]?.input;
    expect(input?.Key).toEqual({ postId: 'abc123' });
    expect(input?.UpdateExpression).toBe('SET #duplicateOf = :duplicateOf');
    expect(input?.ExpressionAttributeNames).toEqual({ '#duplicateOf': 'duplicateOf' });
    expect(input?.ExpressionAttributeValues).toEqual({ ':duplicateOf': 'root-post-id' });
  });
});

describe('postsRepo.incrementDupCount', () => {
  it('atomically ADDs 1 to the aliased dupCount attribute', async () => {
    ddbMock.on(UpdateCommand).resolves({});
    const repo = new PostsRepo(client, 'Posts');

    await repo.incrementDupCount('root-post-id');

    const input = ddbMock.commandCalls(UpdateCommand)[0]?.args[0]?.input;
    expect(input?.Key).toEqual({ postId: 'root-post-id' });
    expect(input?.UpdateExpression).toBe('ADD #dupCount :one');
    expect(input?.ExpressionAttributeNames).toEqual({ '#dupCount': 'dupCount' });
    expect(input?.ExpressionAttributeValues).toEqual({ ':one': 1 });
  });
});
