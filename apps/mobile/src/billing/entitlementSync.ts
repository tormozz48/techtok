import type { EntitlementResponse } from '@techtok/shared';
import type { Purchase } from 'expo-iap';
import { verifyPlayPurchase } from '@/api/client';
import { logError, serializeError } from '@/state/logStore';
import { queryClient } from '@/state/queryClient';
import { acknowledgePurchase, fetchOwnedPurchases, isPlayBillingSupported } from './playBilling';
import { type SyncPlayPurchasesResult, syncPlayPurchases } from './syncPlayPurchases';

export async function syncEntitlementFromPlay(): Promise<SyncPlayPurchasesResult> {
  if (!isPlayBillingSupported()) return { kind: 'nothing-to-verify' };

  let owned: Purchase[] = [];
  const result = await syncPlayPurchases({
    getOwnedPurchases: async () => {
      owned = await fetchOwnedPurchases();
      return owned;
    },
    verify: verifyPlayPurchase,
    onError: (error, purchaseToken) =>
      logError(
        'play purchase verification failed',
        { purchaseToken, ...serializeError(error) },
        error,
      ),
  });

  if (result.kind === 'verified') {
    applyEntitlement(result.entitlement);
    if (result.entitlement.plan === 'plus') await acknowledgeUnacknowledged(owned);
  }

  return result;
}

export function applyEntitlement(entitlement: EntitlementResponse): void {
  queryClient.setQueryData(['entitlement'], entitlement);
}

async function acknowledgeUnacknowledged(purchases: readonly Purchase[]): Promise<void> {
  for (const purchase of purchases) {
    if (isAcknowledged(purchase)) continue;
    try {
      await acknowledgePurchase(purchase);
    } catch (error) {
      logError('play purchase acknowledgement failed', serializeError(error), error);
    }
  }
}

function isAcknowledged(purchase: Purchase): boolean {
  return (purchase as { isAcknowledgedAndroid?: boolean | null }).isAcknowledgedAndroid === true;
}
