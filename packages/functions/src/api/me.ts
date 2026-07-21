import { meResponseSchema } from '@techtok/shared';
import { getUsersRepo } from '../repos';
import { jsonResponse, withDeviceId } from './http';
import { toMeResponse } from './toMeResponse';

export const handler = withDeviceId(async (_event, deviceId) => {
  const user = await getUsersRepo().touch(deviceId);
  return jsonResponse(200, meResponseSchema.parse(toMeResponse(user)));
});
