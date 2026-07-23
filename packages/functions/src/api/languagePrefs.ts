import { languagePrefsRequestSchema, meResponseSchema } from '@techtok/shared';
import { getUsersRepo } from '../repos';
import { jsonResponse, parseJsonBody, withDeviceId } from './http';
import { toMeResponse } from './toMeResponse';

export const handler = withDeviceId(async (event, deviceId) => {
  const body = parseJsonBody(event, languagePrefsRequestSchema);
  if (!body.ok) return body.response;

  const user = await getUsersRepo().updateLanguage(deviceId, body.data.language);
  return jsonResponse(200, meResponseSchema.parse(toMeResponse(user)));
});
