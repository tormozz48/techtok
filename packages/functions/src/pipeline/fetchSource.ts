import { Logger } from '@aws-lambda-powertools/logger';
import {
  createDynamoClient,
  createPostsRepo,
  createSourcesRepo,
  createSqsClient,
  createTransformQueue,
  type FetchFeedResult,
  findDuplicateOf,
  type IngestResult,
  ingestSource,
  type PostsRepo,
  type SourceRecord,
  type SourcesRepo,
  type TransformQueue,
} from '@techtok/core';
import { requireEnv } from '../env';

const logger = new Logger({ serviceName: 'fetchSource' });

let postsRepo: PostsRepo | undefined;
function getPostsRepo(): PostsRepo {
  postsRepo ??= createPostsRepo(createDynamoClient(), requireEnv('POSTS_TABLE_NAME'));
  return postsRepo;
}

let sourcesRepo: SourcesRepo | undefined;
function getSourcesRepo(): SourcesRepo {
  sourcesRepo ??= createSourcesRepo(createDynamoClient(), requireEnv('SOURCES_TABLE_NAME'));
  return sourcesRepo;
}

let transformQueue: TransformQueue | undefined;
function getTransformQueue(): TransformQueue {
  transformQueue ??= createTransformQueue(createSqsClient(), requireEnv('TRANSFORM_QUEUE_URL'));
  return transformQueue;
}

async function fetchFeed(source: SourceRecord): Promise<FetchFeedResult> {
  const headers: Record<string, string> = {};
  if (source.etag) headers['If-None-Match'] = source.etag;
  if (source.lastModified) headers['If-Modified-Since'] = source.lastModified;

  const response = await fetch(source.rssUrl, { headers });
  if (response.status === 304) {
    return { status: 'not-modified' };
  }
  if (!response.ok) {
    throw new Error(`fetch ${source.rssUrl} failed with status ${response.status}`);
  }

  return {
    status: 'ok',
    body: await response.text(),
    etag: response.headers.get('etag') ?? undefined,
    lastModified: response.headers.get('last-modified') ?? undefined,
  };
}

export async function handler(source: SourceRecord): Promise<IngestResult> {
  const result = await ingestSource(source, {
    fetchFeed,
    putIfNew: (post) => getPostsRepo().putIfNew(post),
    enqueueNew: (posts) => getTransformQueue().enqueueNew(posts),
    recordFetchResult: (sourceId, outcome) => getSourcesRepo().recordFetchResult(sourceId, outcome),
    findDuplicate: (post) =>
      findDuplicateOf(post, {
        queryRecentByTopic: (topic) => getPostsRepo().queryByTopic(topic, { limit: 50 }),
      }),
  });

  if (result.errors.length > 0) {
    logger.warn('source fetched with errors', { ...result });
  } else {
    logger.info('source fetched', { ...result });
  }

  return result;
}
