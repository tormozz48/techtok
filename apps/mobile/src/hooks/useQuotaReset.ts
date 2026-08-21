import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { msUntilQuotaReset } from '@/utils/quotaReset';

const RETRY_MS = 60_000;
const MAX_RETRIES = 10;

export function useQuotaReset(resetsAt: string | undefined, onReset: () => void): void {
  const onResetRef = useRef(onReset);

  useEffect(() => {
    onResetRef.current = onReset;
  }, [onReset]);

  useEffect(() => {
    if (!resetsAt) return;

    let timer: ReturnType<typeof setTimeout> | undefined;
    let retries = 0;

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
