import { isAfter, parseISO } from 'date-fns';
import {
  ACCESS_GRANTING_SUBSCRIPTION_STATES,
  type PlaySubscriptionPurchase,
  type PlayVerification,
  type VerifyPlayPurchaseOptions,
} from './playBilling.types';

export function verifyPlayPurchase(
  purchase: PlaySubscriptionPurchase,
  options: VerifyPlayPurchaseOptions,
): PlayVerification {
  const { expectedProductId, expectedObfuscatedAccountId, now = new Date() } = options;

  if (!matchesAccount(purchase, expectedObfuscatedAccountId)) {
    return { entitled: false, reason: 'account_mismatch' };
  }

  const lineItem = purchase.lineItems?.find((item) => item.productId === expectedProductId);
  if (!lineItem) return { entitled: false, reason: 'unknown_product' };

  const state = purchase.subscriptionState ?? '';
  if (!ACCESS_GRANTING_SUBSCRIPTION_STATES.includes(state)) {
    return { entitled: false, reason: 'inactive_state' };
  }

  const expiryTime = lineItem.expiryTime;
  if (!expiryTime) return { entitled: false, reason: 'missing_expiry' };

  const expiresAt = parseISO(expiryTime);
  if (Number.isNaN(expiresAt.getTime())) return { entitled: false, reason: 'missing_expiry' };
  if (!isAfter(expiresAt, now)) return { entitled: false, reason: 'expired' };

  return {
    entitled: true,
    productId: expectedProductId,
    expiresAt: expiresAt.toISOString(),
    basePlanId: lineItem.offerDetails?.basePlanId,
    autoRenewing: lineItem.autoRenewingPlan?.autoRenewEnabled ?? false,
    isTestPurchase: purchase.testPurchase !== undefined,
  };
}

function matchesAccount(
  purchase: PlaySubscriptionPurchase,
  expectedObfuscatedAccountId: string | undefined,
): boolean {
  if (!expectedObfuscatedAccountId) return true;
  const actual = purchase.externalAccountIdentifiers?.obfuscatedExternalAccountId;
  if (!actual) return true;
  return actual === expectedObfuscatedAccountId;
}
