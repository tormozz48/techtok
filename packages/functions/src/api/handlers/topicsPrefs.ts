import { meResponseSchema, topicsPrefsRequestSchema } from '@techtok/shared';
import { getUsersRepo } from '../../repos';
import { jsonResponse, parseJsonBody, withAuth } from '../lib/http';
import { toMeResponse } from '../transformers/toMeResponse';

export const handler = withAuth(async (event, auth) => {
  const body = parseJsonBody(event, topicsPrefsRequestSchema);
  if (!body.ok) return body.response;

  const user = await getUsersRepo().updateTopics(auth.userId, body.data.topics);
  return jsonResponse(200, meResponseSchema.parse(toMeResponse(user)));
});
