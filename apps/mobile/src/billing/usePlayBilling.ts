import {
  PLUS_BASE_PLAN_IDS,
  PLUS_MONTHLY_BASE_PLAN_ID,
  PLUS_YEARLY_BASE_PLAN_ID,
} from '@techtok/shared';
import { purchaseErrorListener, purchaseUpdatedListener } from 'expo-iap';
import { useCallback, useEffect, useState } from 'react';
import { fetchMe } from '@/api/client';
import { logError, logEvent, serializeError } from '@/state/logStore';
import { syncEntitlementFromPlay } from './entitlementSync';
import { obfuscatedAccountId } from './obfuscatedAccountId';
import {
  fetchPlusOffers,
  isPlayBillingSupported,
  openPlaySubscriptionSettings,
  type PlusPlanOffer,
  requestPlusSubscription,
} from './playBilling';

export type PurchaseStatus = 'idle' | 'loading' | 'purchasing' | 'verifying' | 'error';

export interface PlayBillingState {
  readonly supported: boolean;
  readonly status: PurchaseStatus;
  readonly monthly?: PlusPlanOffer;
  readonly yearly?: PlusPlanOffer;
  readonly purchase: (basePlanId: string) => Promise<void>;
  readonly restore: () => Promise<void>;
  readonly manage: () => Promise<void>;
}

export function usePlayBilling(): PlayBillingState {
  const supported = isPlayBillingSupported();
  const [status, setStatus] = useState<PurchaseStatus>(supported ? 'loading' : 'idle');
  const [offers, setOffers] = useState<PlusPlanOffer[]>([]);

  useEffect(() => {
    if (!supported) return;
    let cancelled = false;

    fetchPlusOffers(PLUS_BASE_PLAN_IDS)
      .then((loaded) => {
        if (cancelled) return;
        setOffers(loaded);
        setStatus('idle');
      })
      .catch((error) => {
        if (cancelled) return;
        logError('play offer fetch failed', serializeError(error), error);
        setStatus('error');
      });

    return () => {
      cancelled = true;
    };
  }, [supported]);

  useEffect(() => {
    if (!supported) return;

    const updated = purchaseUpdatedListener(() => {
      setStatus('verifying');
      syncEntitlementFromPlay()
        .then((result) => {
          logEvent('play_purchase_verified', { outcome: result.kind });
          setStatus(result.kind === 'failed' ? 'error' : 'idle');
        })
        .catch((error) => {
          logError('play purchase sync failed', serializeError(error), error);
          setStatus('error');
        });
    });

    const failed = purchaseErrorListener((error) => {
      logEvent('play_purchase_error', { code: error.code ?? 'unknown' });
      setStatus(error.code === 'user-cancelled' ? 'idle' : 'error');
    });

    return () => {
      updated.remove();
      failed.remove();
    };
  }, [supported]);

  const purchase = useCallback(
    async (basePlanId: string) => {
      const offer = offers.find((candidate) => candidate.basePlanId === basePlanId);
      if (!offer) {
        setStatus('error');
        return;
      }
      setStatus('purchasing');
      try {
        const me = await fetchMe();
        await requestPlusSubscription(offer, await obfuscatedAccountId(me.userId));
      } catch (error) {
        logError('play purchase request failed', serializeError(error), error);
        setStatus('error');
      }
    },
    [offers],
  );

  const restore = useCallback(async () => {
    setStatus('verifying');
    try {
      const result = await syncEntitlementFromPlay();
      setStatus(result.kind === 'failed' ? 'error' : 'idle');
    } catch (error) {
      logError('play purchase restore failed', serializeError(error), error);
      setStatus('error');
    }
  }, []);

  const manage = useCallback(async () => {
    try {
      await openPlaySubscriptionSettings();
    } catch (error) {
      logError('play subscription deep link failed', serializeError(error), error);
    }
  }, []);

  return {
    supported,
    status,
    monthly: offers.find((offer) => offer.basePlanId === PLUS_MONTHLY_BASE_PLAN_ID),
    yearly: offers.find((offer) => offer.basePlanId === PLUS_YEARLY_BASE_PLAN_ID),
    purchase,
    restore,
    manage,
  };
}
