import { meResponseSchema } from '@techtok/shared';
import { getUsersRepo } from '../../repos';
import { extractDeviceLanguage } from '../lib/deviceId';
import { jsonResponse, withDeviceId } from '../lib/http';
import { toMeResponse } from '../transformers/toMeResponse';

export const handler = withDeviceId(async (event, deviceId) => {
  const user = await getUsersRepo().touch(deviceId, extractDeviceLanguage(event));
  return jsonResponse(200, meResponseSchema.parse(toMeResponse(user)));
});
