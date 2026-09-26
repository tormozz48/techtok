import { Logger } from '@aws-lambda-powertools/logger';
import { errorMessage } from '@techtok/core';
import { testerSignupRequestSchema, testerSignupResponseSchema } from '@techtok/shared';
import { getTestersRepo } from '../../repos';
import { getTesterGroupClient, isTesterGroupConfigured } from '../../testerGroup';
import { jsonResponse, parseJsonBody, withPublic } from '../lib/http';

const logger = new Logger({ serviceName: 'testerSignup' });

export const handler = withPublic(async (event) => {
  const body = parseJsonBody(event, testerSignupRequestSchema);
  if (!body.ok) return body.response;

  const { email } = body.data;
  await getTestersRepo().create(email);

  if (!isTesterGroupConfigured()) {
    logger.warn('tester group not configured, signup queued for manual addition');
    return jsonResponse(200, testerSignupResponseSchema.parse({ status: 'queued' }));
  }

  try {
    await getTesterGroupClient().addMember(email);
  } catch (err) {
    logger.error('Cloud Identity addMember failed, signup queued', { error: errorMessage(err) });
    return jsonResponse(200, testerSignupResponseSchema.parse({ status: 'queued' }));
  }

  return jsonResponse(200, testerSignupResponseSchema.parse({ status: 'added' }));
});
