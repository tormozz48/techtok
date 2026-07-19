import { createDynamoClient, createPostsRepo, type PostsRepo } from '@techtok/core';
import { feedQuerySchema, feedResponseSchema } from '@techtok/shared';
import type { APIGatewayProxyHandlerV2 } from 'aws-lambda';
import { requireEnv } from '../env';
import { jsonResponse } from './jsonResponse';
import { computeNextBefore } from './pagination';
import { toCard } from './toCard';

let repo: PostsRepo | undefined;
function getRepo(): PostsRepo {
  repo ??= createPostsRepo(createDynamoClient(), requireEnv('POSTS_TABLE_NAME'));
  return repo;
}

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  const parsedQuery = feedQuerySchema.safeParse(event.queryStringParameters ?? {});
  if (!parsedQuery.success) {
    return jsonResponse(400, {
      error: { code: 'invalid_query', message: parsedQuery.error.message },
    });
  }

  const { limit, before } = parsedQuery.data;
  const posts = await getRepo().queryRecent({ limit, before });

  const body = feedResponseSchema.parse({
    items: posts.map(toCard),
    nextBefore: computeNextBefore(posts, limit),
  });

  return jsonResponse(200, body);
};
