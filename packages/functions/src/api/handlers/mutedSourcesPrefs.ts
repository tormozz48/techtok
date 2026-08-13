import { meResponseSchema, mutedSourcesRequestSchema } from '@techtok/shared';
import { getUsersRepo } from '../../repos';
import { jsonResponse, parseJsonBody, withAuth } from '../lib/http';
import { toMeResponse } from '../transformers/toMeResponse';

export const handler = withAuth(async (event, auth) => {
  const body = parseJsonBody(event, mutedSourcesRequestSchema);
  if (!body.ok) return body.response;

  const user = await getUsersRepo().updateMutedSources(auth.userId, body.data.sourceIds);
  return jsonResponse(200, meResponseSchema.parse(toMeResponse(user)));
});
