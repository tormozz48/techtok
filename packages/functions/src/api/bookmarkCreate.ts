import {
  createDynamoClient,
  createPostsRepo,
  createUserActivityRepo,
  type PostsRepo,
  type UserActivityRepo,
} from '@techtok/core';
import { bookmarkCreateRequestSchema, DEVICE_ID_HEADER } from '@techtok/shared';
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

  const parsedBody = bookmarkCreateRequestSchema.safeParse(rawBody);
  if (!parsedBody.success) {
    return jsonResponse(400, {
      error: { code: 'invalid_body', message: parsedBody.error.message },
    });
  }

  const { posts, activity } = getRepos();
  const [post] = await posts.getByIds([parsedBody.data.postId]);
  if (!post) {
    return jsonResponse(404, {
      error: { code: 'post_not_found', message: 'No post with that id' },
    });
  }

  await activity.addBookmark(deviceId, post.postId, {
    cardTitle: post.cardTitle,
    sourceName: post.sourceName,
    url: post.url,
  });

  return { statusCode: 204, body: '' };
};
