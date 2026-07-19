import { createDynamoClient, createUsersRepo, type UsersRepo } from '@techtok/core';
import { DEVICE_ID_HEADER, meResponseSchema } from '@techtok/shared';
import type { APIGatewayProxyHandlerV2 } from 'aws-lambda';
import { requireEnv } from '../env';
import { extractDeviceId } from './deviceId';
import { jsonResponse } from './jsonResponse';

let usersRepo: UsersRepo | undefined;
function getRepo(): UsersRepo {
  usersRepo ??= createUsersRepo(createDynamoClient(), requireEnv('USERS_TABLE_NAME'));
  return usersRepo;
}

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  const deviceId = extractDeviceId(event);
  if (!deviceId) {
    return jsonResponse(400, {
      error: { code: 'missing_device_id', message: `${DEVICE_ID_HEADER} header is required` },
    });
  }

  const user = await getRepo().touch(deviceId);

  const body = meResponseSchema.parse({
    userId: user.userId,
    topics: user.topics,
    createdAt: user.createdAt,
  });

  return jsonResponse(200, body);
};
