import { testerSignupRequestSchema, testerSignupResponseSchema } from '@techtok/shared';
import { getTestersRepo } from '../../repos';
import { jsonResponse, parseJsonBody, withPublic } from '../lib/http';

export const handler = withPublic(async (event) => {
  const body = parseJsonBody(event, testerSignupRequestSchema);
  if (!body.ok) return body.response;

  const { email } = body.data;
  const testers = getTestersRepo();
  const alreadyReceived = await testers.exists(email);
  if (alreadyReceived) {
    return jsonResponse(200, testerSignupResponseSchema.parse({ status: 'already_received' }));
  }

  await testers.create(email);
  return jsonResponse(200, testerSignupResponseSchema.parse({ status: 'received' }));
});
