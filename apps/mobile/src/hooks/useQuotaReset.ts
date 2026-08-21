import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { msUntilQuotaReset } from '@/utils/quotaReset';

/** How long to wait before trying again when the boundary has passed by this
 * device's clock but the server still reports the same `resetsAt` — either
 * the device is running ahead, or the refetch didn't land (offline). */
const RETRY_MS = 60_000;
/** Caps that retry so a device whose clock is wildly wrong, or one that stays
 * offline, doesn't turn this into an open-ended poll. Ten minutes of skew is
 * far more than a time-synced device ever has. */
const MAX_RETRIES = 10;

/**
 * Runs `onReset` once D69's daily-quota reset instant (`resetsAt`, the user's
 * next local midnight) passes.
 *
 * Everything the client knows about the quota is a snapshot: a cached feed
 * page's `quotaExhausted` flag, and the counters in the `['entitlement']`
 * cache. Server-side those counters roll over on their own (`effectiveQuota`),
 * but nothing client-side notices the moment it happens — so a screen gating
 * on an exhausted quota stayed gated until something else happened to refetch,
 * which for a user parked on `/paywall` meant relaunching the app.
 *
 * Two triggers, because neither alone is enough: a timer for the app left open
 * across the boundary, and an `AppState` re-check for the app that was
 * backgrounded across it (Android suspends the JS thread, so a timer scheduled
 * hours out may simply never fire).
 */
export function useQuotaReset(resetsAt: string | undefined, onReset: () => void): void {
  const onResetRef = useRef(onReset);

  useEffect(() => {
    onResetRef.current = onReset;
  }, [onReset]);

  useEffect(() => {
    if (!resetsAt) return;

    let timer: ReturnType<typeof setTimeout> | undefined;
    let retries = 0;

    // A successful reset changes `resetsAt` (the next day's midnight), which
    // re-runs this effect from scratch — so anything scheduled from here is
    // by definition a "we fired and nothing changed" retry.
    const schedule = () => {
      const remaining = msUntilQuotaReset(resetsAt);
      if (remaining === undefined) return;
      if (remaining <= 0 && retries >= MAX_RETRIES) return;
      timer = setTimeout(fire, remaining > 0 ? remaining : RETRY_MS);
    };

    const fire = () => {
      retries += 1;
      onResetRef.current();
      schedule();
    };

    schedule();

    const subscription = AppState.addEventListener('change', (status) => {
      if (status !== 'active') return;
      const remaining = msUntilQuotaReset(resetsAt);
      if (remaining === undefined || remaining > 0) return;
      clearTimeout(timer);
      fire();
    });

    return () => {
      clearTimeout(timer);
      subscription.remove();
    };
  }, [resetsAt]);
}
