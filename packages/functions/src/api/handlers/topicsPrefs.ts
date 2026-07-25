import { meResponseSchema, topicsPrefsRequestSchema } from '@techtok/shared';
import { getUsersRepo } from '../../repos';
import { jsonResponse, parseJsonBody, withDeviceId } from '../lib/http';
import { toMeResponse } from '../transformers/toMeResponse';

export const handler = withDeviceId(async (event, deviceId) => {
  const body = parseJsonBody(event, topicsPrefsRequestSchema);
  if (!body.ok) return body.response;

  const user = await getUsersRepo().updateTopics(deviceId, body.data.topics);
  return jsonResponse(200, meResponseSchema.parse(toMeResponse(user)));
});
