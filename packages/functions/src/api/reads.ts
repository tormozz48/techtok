import {
  createDynamoClient,
  createPostsRepo,
  createUserActivityRepo,
  type PostsRepo,
  type UserActivityRepo,
} from '@techtok/core';
import { DEVICE_ID_HEADER, readsRequestSchema } from '@techtok/shared';
import type { APIGatewayProxyHandlerV2 } from 'aws-lambda';
import { requireEnv } from '../env';
import { extractDeviceId } from './deviceId';
import { jsonResponse } from './jsonResponse';

interface Repos {
  posts: PostsRepo;
  activity: UserActivityRepo;
}

let repos: Repos | undefined;
function getRepos(): Repos {
  if (!repos) {
    const client = createDynamoClient();
    repos = {
      posts: createPostsRepo(client, requireEnv('POSTS_TABLE_NAME')),
      activity: createUserActivityRepo(client, requireEnv('USER_ACTIVITY_TABLE_NAME')),
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

  let rawBody: unknown;
  try {
    rawBody = JSON.parse(event.body ?? '{}');
  } catch {
    return jsonResponse(400, {
      error: { code: 'invalid_body', message: 'Body is not valid JSON' },
    });
  }

  const parsedBody = readsRequestSchema.safeParse(rawBody);
  if (!parsedBody.success) {
    return jsonResponse(400, {
      error: { code: 'invalid_body', message: parsedBody.error.message },
    });
  }

  const { posts, activity } = getRepos();
  const { postIds } = parsedBody.data;
  const readAt = new Date().toISOString();

  // A postId can be missing (already TTL'd) — that's a content-level gap, not
  // an infra failure, so it's skipped rather than thrown.
  const foundPosts = await posts.getByIds(postIds);
  await Promise.all(
    foundPosts.map((post) =>
      activity.markRead(
        deviceId,
        post.postId,
        { cardTitle: post.cardTitle, sourceName: post.sourceName, url: post.url },
        readAt,
      ),
    ),
  );

  return { statusCode: 204, body: '' };
};
