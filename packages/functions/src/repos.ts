import {
  createDynamoClient,
  createSourceWeightsCache,
  PostsRepo,
  SourcesRepo,
  UserActivityRepo,
  UsersRepo,
} from '@techtok/core';
import { requireEnv } from './env';
import { lazy } from './lazy';

/**
 * Per-container singletons for the DynamoDB-backed repos. Every handler in
 * this package shares one document client, and each repo reads its table
 * name only when first used — so a Lambda that lacks an env var it never
 * touches keeps working.
 */
export const getDynamoClient = lazy(createDynamoClient);

export const getPostsRepo = lazy(
  () => new PostsRepo(getDynamoClient(), requireEnv('POSTS_TABLE_NAME')),
);

export const getUsersRepo = lazy(
  () => new UsersRepo(getDynamoClient(), requireEnv('USERS_TABLE_NAME')),
);

export const getUserActivityRepo = lazy(
  () => new UserActivityRepo(getDynamoClient(), requireEnv('USER_ACTIVITY_TABLE_NAME')),
);

export const getSourcesRepo = lazy(
  () => new SourcesRepo(getDynamoClient(), requireEnv('SOURCES_TABLE_NAME')),
);

export const getSourceWeightsCache = lazy(() => createSourceWeightsCache(getSourcesRepo()));
