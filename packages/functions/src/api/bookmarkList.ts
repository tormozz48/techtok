import { createDynamoClient, createUserActivityRepo, type UserActivityRepo } from '@techtok/core';
import { bookmarksQuerySchema, bookmarksResponseSchema, DEVICE_ID_HEADER } from '@techtok/shared';
import type { APIGatewayProxyHandlerV2 } from 'aws-lambda';
import { requireEnv } from '../env';
import { extractDeviceId } from './deviceId';
import { jsonResponse } from './jsonResponse';
import { toBookmarkItem } from './toBookmarkItem';

let activityRepo: UserActivityRepo | undefined;
function getRepo(): UserActivityRepo {
  activityRepo ??= createUserActivityRepo(
    createDynamoClient(),
    requireEnv('USER_ACTIVITY_TABLE_NAME'),
  );
  return activityRepo;
}

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  const deviceId = extractDeviceId(event);
  if (!deviceId) {
    return jsonResponse(400, {
      error: { code: 'missing_device_id', message: `${DEVICE_ID_HEADER} header is required` },
    });
  }

  const parsedQuery = bookmarksQuerySchema.safeParse(event.queryStringParameters ?? {});
  if (!parsedQuery.success) {
    return jsonResponse(400, {
      error: { code: 'invalid_query', message: parsedQuery.error.message },
    });
  }

  const { limit, cursor } = parsedQuery.data;
  const page = await getRepo().queryBookmarks(deviceId, { limit, cursor });

  const body = bookmarksResponseSchema.parse({
    items: page.items.map(toBookmarkItem),
    nextCursor: page.nextCursor,
  });

  return jsonResponse(200, body);
};
