import { meResponseSchema, mutedSourcesRequestSchema } from '@techtok/shared';
import { getUsersRepo } from '../../repos';
import { jsonResponse, parseJsonBody, withDeviceId } from '../lib/http';
import { toMeResponse } from '../transformers/toMeResponse';

export const handler = withDeviceId(async (event, deviceId) => {
  const body = parseJsonBody(event, mutedSourcesRequestSchema);
  if (!body.ok) return body.response;

  const user = await getUsersRepo().updateMutedSources(deviceId, body.data.sourceIds);
  return jsonResponse(200, meResponseSchema.parse(toMeResponse(user)));
});
