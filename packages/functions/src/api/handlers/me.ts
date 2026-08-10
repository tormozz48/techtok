import { meResponseSchema } from '@techtok/shared';
import { getUsersRepo } from '../../repos';
import { extractDeviceLanguage, extractDeviceTimezone } from '../lib/auth';
import { jsonResponse, withAuth } from '../lib/http';
import { toMeResponse } from '../transformers/toMeResponse';

export const handler = withAuth(async (event, auth) => {
  const user = await getUsersRepo().touch(auth.userId, {
    deviceLanguage: extractDeviceLanguage(event),
    timezone: extractDeviceTimezone(event),
    email: auth.email,
    name: auth.name,
  });
  return jsonResponse(200, meResponseSchema.parse(toMeResponse(user)));
});
