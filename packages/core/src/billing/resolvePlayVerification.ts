import type { Entitlement } from '../entitlement/entitlement.types';
import { obfuscatedAccountId } from './obfuscatedAccountId';
import type { PlayPurchaseLookup } from './playBilling.types';
import { verifyPlayPurchase } from './verifyPlayPurchase';

export type PlayRejection = 'invalid_purchase_token' | 'purchase_token_claimed';

export type PlayVerificationOutcome =
  | { readonly kind: 'grant'; readonly entitlement: Entitlement }
  | { readonly kind: 'revoke'; readonly entitlement: Entitlement }
  | { readonly kind: 'unchanged' }
  | { readonly kind: 'rejected'; readonly reason: PlayRejection };

export interface ResolvePlayVerificationInput {
  readonly userId: string;
  readonly purchaseToken: string;
  readonly expectedProductId: string;
  readonly lookup: PlayPurchaseLookup;
  readonly verifiedAt: string;
  readonly currentEntitlement?: Entitlement;
  readonly tokenOwnerUserId?: string;
  readonly now?: Date;
}

export function resolvePlayVerification(
  input: ResolvePlayVerificationInput,
): PlayVerificationOutcome {
  const {
    userId,
    purchaseToken,
    expectedProductId,
    lookup,
    verifiedAt,
    currentEntitlement,
    tokenOwnerUserId,
    now,
  } = input;

  if (tokenOwnerUserId !== undefined && tokenOwnerUserId !== userId) {
    return { kind: 'rejected', reason: 'purchase_token_claimed' };
  }

  if (!lookup.found) return { kind: 'rejected', reason: 'invalid_purchase_token' };

  const verification = verifyPlayPurchase(lookup.purchase, {
    expectedProductId,
    expectedObfuscatedAccountId: obfuscatedAccountId(userId),
    now,
  });

  if (verification.entitled) {
    return {
      kind: 'grant',
      entitlement: {
        plan: 'plus',
        source: 'play',
        expiresAt: verification.expiresAt,
        productId: verification.productId,
        purchaseToken,
        verifiedAt,
      },
    };
  }

  if (verification.reason === 'account_mismatch') {
    return { kind: 'rejected', reason: 'purchase_token_claimed' };
  }

  if (grantsAccessVia(currentEntitlement, purchaseToken)) {
    return {
      kind: 'revoke',
      entitlement: {
        plan: 'free',
        source: 'play',
        productId: currentEntitlement?.productId,
        purchaseToken,
        verifiedAt,
      },
    };
  }

  return { kind: 'unchanged' };
}

function grantsAccessVia(
  entitlement: Entitlement | undefined,
  purchaseToken: string,
): entitlement is Entitlement {
  if (!entitlement) return false;
  return (
    entitlement.plan === 'plus' &&
    entitlement.source === 'play' &&
    entitlement.purchaseToken === purchaseToken
  );
}
