import {
  createDynamoClient,
  createPostsRepo,
  createSourcesRepo,
  createUserActivityRepo,
  createUsersRepo,
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

export const getPostsRepo = lazy(() =>
  createPostsRepo(getDynamoClient(), requireEnv('POSTS_TABLE_NAME')),
);

export const getUsersRepo = lazy(() =>
  createUsersRepo(getDynamoClient(), requireEnv('USERS_TABLE_NAME')),
);

export const getUserActivityRepo = lazy(() =>
  createUserActivityRepo(getDynamoClient(), requireEnv('USER_ACTIVITY_TABLE_NAME')),
);

export const getSourcesRepo = lazy(() =>
  createSourcesRepo(getDynamoClient(), requireEnv('SOURCES_TABLE_NAME')),
);
