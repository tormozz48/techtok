import { createDynamoClient, createUserActivityRepo, type UserActivityRepo } from '@techtok/core';
import { DEVICE_ID_HEADER } from '@techtok/shared';
import type { APIGatewayProxyHandlerV2 } from 'aws-lambda';
import { requireEnv } from '../env';
import { extractDeviceId } from './deviceId';
import { jsonResponse } from './jsonResponse';

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

  const postId = event.pathParameters?.postId;
  if (!postId) {
    return jsonResponse(400, {
      error: { code: 'missing_post_id', message: 'postId path parameter is required' },
    });
  }

  await getRepo().removeBookmark(deviceId, postId);

  return { statusCode: 204, body: '' };
};
