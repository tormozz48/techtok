import * as Updates from 'expo-updates';
import { AppState } from 'react-native';
import { decideOnForeground } from '@/utils/otaUpdate';
import { useAuthStore } from './authStore';
import { logError, logEvent } from './eventsQueue';

let started = false;
let isUpdatePending = false;
let isFetching = false;
let backgroundedAtMs: number | null = null;

export function startOtaUpdates(): void {
  if (started || !Updates.isEnabled) return;
  started = true;

  fetchUpdate();

  AppState.addEventListener('change', (status) => {
    if (status !== 'active') {
      backgroundedAtMs ??= Date.now();
      return;
    }

    const action = decideOnForeground({
      isUpdatePending,
      backgroundedAtMs,
      nowMs: Date.now(),
      isSignedIn: useAuthStore.getState().status === 'signedIn',
    });
    backgroundedAtMs = null;

    if (action === 'reload') {
      logEvent('ota_update_reload_triggered');
      Updates.reloadAsync().catch((error) => {
        logError('ota update reload failed', { message: String(error) });
      });
      return;
    }
    if (action === 'check') fetchUpdate();
  });
}

async function fetchUpdate(): Promise<void> {
  if (isUpdatePending || isFetching) return;
  isFetching = true;
  try {
    const check = await Updates.checkForUpdateAsync();
    if (!check.isAvailable && !check.isRollBackToEmbedded) return;
    const fetched = await Updates.fetchUpdateAsync();
    isUpdatePending = fetched.isNew || fetched.isRollBackToEmbedded;
    if (isUpdatePending) logEvent('ota_update_fetched');
  } catch (error) {
    logError('ota update fetch failed', { message: String(error) });
  } finally {
    isFetching = false;
  }
}
