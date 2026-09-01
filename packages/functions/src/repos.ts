import {
  ContentQueue,
  createDynamoClient,
  createSourceWeightsCache,
  createSqlClient,
  createSqsClient,
  PostsRepo,
  SourcesRepo,
  TranslateQueue,
  UserActivityRepo,
  UsersRepo,
} from '@techtok/core';
import { requireEnv } from './env';
import { lazy } from './lazy';

const getDynamoClient = lazy(createDynamoClient);
const getSqlClient = lazy(() => createSqlClient(requireEnv('DATABASE_URL')));

export const getPostsRepo = lazy(
  () => new PostsRepo(getDynamoClient(), requireEnv('POSTS_TABLE_NAME')),
);

export const getUsersRepo = lazy(
  () => new UsersRepo(getDynamoClient(), requireEnv('USERS_TABLE_NAME')),
);

export const getUserActivityRepo = lazy(
  () => new UserActivityRepo(getDynamoClient(), requireEnv('USER_ACTIVITY_TABLE_NAME')),
);

export const getSourcesRepo = lazy(() => new SourcesRepo(getSqlClient()));

export const getSourceWeightsCache = lazy(() => createSourceWeightsCache(getSourcesRepo()));

export const getTranslateQueue = lazy(
  () => new TranslateQueue(createSqsClient(), requireEnv('TRANSLATE_QUEUE_URL')),
);

export const getContentQueue = lazy(
  () => new ContentQueue(createSqsClient(), requireEnv('CONTENT_QUEUE_URL')),
);
