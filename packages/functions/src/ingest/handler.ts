import { Logger } from '@aws-lambda-powertools/logger';
import { createDynamoClient, createPostsRepo, ingestSource, type PostsRepo } from '@techtok/core';
import { requireEnv } from '../env';
import { PHASE0_SOURCES } from './sources';

const logger = new Logger({ serviceName: 'ingest' });

let repo: PostsRepo | undefined;
function getRepo(): PostsRepo {
  repo ??= createPostsRepo(createDynamoClient(), requireEnv('POSTS_TABLE_NAME'));
  return repo;
}

async function fetchFeed(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`fetch ${url} failed with status ${response.status}`);
  }
  return response.text();
}

export async function handler(): Promise<void> {
  const postsRepo = getRepo();
  for (const source of PHASE0_SOURCES) {
    const result = await ingestSource(source, { fetchFeed, putIfNew: postsRepo.putIfNew });
    if (result.errors.length > 0) {
      logger.warn('source ingested with errors', { ...result });
    } else {
      logger.info('source ingested', { ...result });
    }
  }
}
