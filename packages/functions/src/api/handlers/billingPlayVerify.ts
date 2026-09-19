import { Logger } from '@aws-lambda-powertools/logger';
import { errorMessage, type PlayPurchaseLookup, resolvePlayVerification } from '@techtok/core';
import {
  entitlementResponseSchema,
  PLUS_SUBSCRIPTION_PRODUCT_ID,
  playVerifyRequestSchema,
} from '@techtok/shared';
import { getPlayApiClient, isPlayBillingConfigured } from '../../billing';
import { getUsersRepo } from '../../repos';
import { errorResponse, jsonResponse, parseJsonBody, withAuth } from '../lib/http';
import { toEntitlementResponse } from '../transformers/toEntitlementResponse';

const logger = new Logger({ serviceName: 'billing' });

const REJECTION_STATUS: Record<string, number> = {
  invalid_purchase_token: 400,
  purchase_token_claimed: 409,
};

const REJECTION_MESSAGE: Record<string, string> = {
  invalid_purchase_token: 'Google Play does not recognize this purchase token.',
  purchase_token_claimed: 'This subscription is already attached to another account.',
};

export const handler = withAuth(async (event, auth) => {
  const body = parseJsonBody(event, playVerifyRequestSchema);
  if (!body.ok) return body.response;

  if (body.data.productId !== PLUS_SUBSCRIPTION_PRODUCT_ID) {
    return errorResponse(400, 'unknown_product', `Unknown product ${body.data.productId}.`);
  }

  if (!isPlayBillingConfigured()) {
    return errorResponse(
      503,
      'billing_unavailable',
      'Play Billing is not configured on this stage.',
    );
  }

  const { purchaseToken } = body.data;
  const users = getUsersRepo();
  const [user, tokenOwnerUserId] = await Promise.all([
    users.touch(auth.userId, { email: auth.email, name: auth.name }),
    users.findUserIdByPurchaseToken(purchaseToken),
  ]);

  let lookup: PlayPurchaseLookup;
  try {
    lookup = await getPlayApiClient().getSubscriptionPurchase(purchaseToken);
  } catch (err) {
    logger.error('Play Developer API call failed', {
      userId: auth.userId,
      error: errorMessage(err),
    });
    return errorResponse(503, 'billing_unavailable', 'Play Billing is temporarily unavailable.');
  }

  const outcome = resolvePlayVerification({
    userId: auth.userId,
    purchaseToken,
    expectedProductId: PLUS_SUBSCRIPTION_PRODUCT_ID,
    lookup,
    verifiedAt: new Date().toISOString(),
    currentEntitlement: user.entitlement,
    tokenOwnerUserId,
  });

  if (outcome.kind === 'rejected') {
    return errorResponse(
      REJECTION_STATUS[outcome.reason] ?? 400,
      outcome.reason,
      REJECTION_MESSAGE[outcome.reason] ?? 'The purchase could not be verified.',
    );
  }

  const settled =
    outcome.kind === 'unchanged'
      ? user
      : await users.grantEntitlement(auth.userId, outcome.entitlement);

  return jsonResponse(200, entitlementResponseSchema.parse(toEntitlementResponse(settled)));
});
