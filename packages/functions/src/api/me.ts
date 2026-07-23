import { meResponseSchema } from '@techtok/shared';
import { getUsersRepo } from '../repos';
import { extractDeviceLanguage } from './deviceId';
import { jsonResponse, withDeviceId } from './http';
import { toMeResponse } from './toMeResponse';

export const handler = withDeviceId(async (event, deviceId) => {
  const user = await getUsersRepo().touch(deviceId, extractDeviceLanguage(event));
  return jsonResponse(200, meResponseSchema.parse(toMeResponse(user)));
});
