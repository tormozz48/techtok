import { languagePrefsRequestSchema, meResponseSchema } from '@techtok/shared';
import { getUsersRepo } from '../../repos';
import { jsonResponse, parseJsonBody, withAuth } from '../lib/http';
import { toMeResponse } from '../transformers/toMeResponse';

export const handler = withAuth(async (event, auth) => {
  const body = parseJsonBody(event, languagePrefsRequestSchema);
  if (!body.ok) return body.response;

  const user = await getUsersRepo().updateLanguage(auth.userId, body.data.language);
  return jsonResponse(200, meResponseSchema.parse(toMeResponse(user)));
});
