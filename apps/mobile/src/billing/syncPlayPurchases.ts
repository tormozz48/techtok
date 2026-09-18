import type { EntitlementResponse } from '@techtok/shared';
import { PLUS_SUBSCRIPTION_PRODUCT_ID } from '@techtok/shared';

export interface OwnedPurchaseLike {
  readonly productId?: string | null;
  readonly purchaseToken?: string | null;
  readonly isSuspendedAndroid?: boolean | null;
}

export interface SyncPlayPurchasesDeps {
  readonly getOwnedPurchases: () => Promise<readonly OwnedPurchaseLike[]>;
  readonly verify: (request: {
    purchaseToken: string;
    productId: string;
  }) => Promise<EntitlementResponse>;
  readonly onError?: (error: unknown, purchaseToken: string) => void;
}

export type SyncPlayPurchasesResult =
  | { readonly kind: 'verified'; readonly entitlement: EntitlementResponse }
  | { readonly kind: 'nothing-to-verify' }
  | { readonly kind: 'failed' };

export async function syncPlayPurchases(
  deps: SyncPlayPurchasesDeps,
): Promise<SyncPlayPurchasesResult> {
  const owned = await deps.getOwnedPurchases();
  const tokens = plusPurchaseTokens(owned);
  if (tokens.length === 0) return { kind: 'nothing-to-verify' };

  let lastVerified: EntitlementResponse | undefined;
  for (const purchaseToken of tokens) {
    try {
      const entitlement = await deps.verify({
        purchaseToken,
        productId: PLUS_SUBSCRIPTION_PRODUCT_ID,
      });
      if (entitlement.plan === 'plus') return { kind: 'verified', entitlement };
      lastVerified = entitlement;
    } catch (error) {
      deps.onError?.(error, purchaseToken);
    }
  }

  return lastVerified ? { kind: 'verified', entitlement: lastVerified } : { kind: 'failed' };
}

function plusPurchaseTokens(purchases: readonly OwnedPurchaseLike[]): string[] {
  const tokens = new Set<string>();
  for (const purchase of purchases) {
    if (purchase.productId !== PLUS_SUBSCRIPTION_PRODUCT_ID) continue;
    if (purchase.isSuspendedAndroid) continue;
    const token = purchase.purchaseToken;
    if (token) tokens.add(token);
  }
  return [...tokens];
}
