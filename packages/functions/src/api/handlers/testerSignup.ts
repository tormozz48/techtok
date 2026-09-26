import { Logger } from '@aws-lambda-powertools/logger';
import { errorMessage } from '@techtok/core';
import { testerSignupRequestSchema, testerSignupResponseSchema } from '@techtok/shared';
import { getPlayApiClient, getPlayTestingTrack, isPlayBillingConfigured } from '../../billing';
import { getTestersRepo } from '../../repos';
import { errorResponse, jsonResponse, parseJsonBody, withPublic } from '../lib/http';

const logger = new Logger({ serviceName: 'testerSignup' });

export const handler = withPublic(async (event) => {
  const body = parseJsonBody(event, testerSignupRequestSchema);
  if (!body.ok) return body.response;

  if (!isPlayBillingConfigured()) {
    return errorResponse(
      503,
      'billing_unavailable',
      'Play Billing is not configured on this stage.',
    );
  }

  const { email } = body.data;
  const testers = getTestersRepo();
  const existing = await testers.findByEmail(email);
  if (existing?.playAddedAt) {
    return jsonResponse(200, testerSignupResponseSchema.parse({ status: 'already_added' }));
  }

  try {
    await getPlayApiClient().addTester(getPlayTestingTrack(), email);
  } catch (err) {
    logger.error('Play Developer API addTester failed', { error: errorMessage(err) });
    return errorResponse(
      503,
      'tester_signup_unavailable',
      'Adding you as a tester failed. Try again shortly.',
    );
  }

  await testers.recordAdded(email);
  return jsonResponse(200, testerSignupResponseSchema.parse({ status: 'added' }));
});
