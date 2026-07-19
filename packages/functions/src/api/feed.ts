import {
  buildFeed,
  createDynamoClient,
  createPostsRepo,
  createSourcesRepo,
  createSourceWeightsCache,
  createUserActivityRepo,
  createUsersRepo,
  type PostsRepo,
  type SourceWeightsCache,
  type UserActivityRepo,
  type UsersRepo,
} from '@techtok/core';
import { DEVICE_ID_HEADER, feedQuerySchema, feedResponseSchema } from '@techtok/shared';
import type { APIGatewayProxyHandlerV2 } from 'aws-lambda';
import { requireEnv } from '../env';
import { extractDeviceId } from './deviceId';
import { jsonResponse } from './jsonResponse';
import { toCard } from './toCard';

interface Repos {
  posts: PostsRepo;
  users: UsersRepo;
  activity: UserActivityRepo;
  sourceWeights: SourceWeightsCache;
}

let repos: Repos | undefined;
function getRepos(): Repos {
  if (!repos) {
    const client = createDynamoClient();
    repos = {
      posts: createPostsRepo(client, requireEnv('POSTS_TABLE_NAME')),
      users: createUsersRepo(client, requireEnv('USERS_TABLE_NAME')),
      activity: createUserActivityRepo(client, requireEnv('USER_ACTIVITY_TABLE_NAME')),
      sourceWeights: createSourceWeightsCache(
        createSourcesRepo(client, requireEnv('SOURCES_TABLE_NAME')),
      ),
    };
  }
  return repos;
}

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  const deviceId = extractDeviceId(event);
  if (!deviceId) {
    return jsonResponse(400, {
      error: { code: 'missing_device_id', message: `${DEVICE_ID_HEADER} header is required` },
    });
  }

  const parsedQuery = feedQuerySchema.safeParse(event.queryStringParameters ?? {});
  if (!parsedQuery.success) {
    return jsonResponse(400, {
      error: { code: 'invalid_query', message: parsedQuery.error.message },
    });
  }

  const { limit, before } = parsedQuery.data;
  const { posts, users, activity, sourceWeights } = getRepos();
  const user = await users.touch(deviceId);

  const page = await buildFeed(
    {
      queryByTopic: (topic, opts) => posts.queryByTopic(topic, opts),
      getReadSet: (postIds) => activity.getReadSet(deviceId, postIds),
      getSourceWeights: () => sourceWeights.getSourceWeights(),
    },
    { userTopics: user.topics, before, limit },
  );

  const bookmarkedIds = await activity.getBookmarkSet(
    deviceId,
    page.items.map((post) => post.postId),
  );

  const body = feedResponseSchema.parse({
    items: page.items.map((post) => toCard(post, bookmarkedIds.has(post.postId))),
    nextBefore: page.nextBefore,
  });

  return jsonResponse(200, body);
};
