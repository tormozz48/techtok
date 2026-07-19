import * as Network from 'expo-network';

let isWifi = false;

export function getIsWifi(): boolean {
  return isWifi;
}

let started = false;

/** Tracks wifi connectivity for gating image prefetch. Uses expo-network's
 * push-based listener rather than polling — no dev-client requirement, it's
 * part of the curated Expo SDK bundled in Expo Go. */
export function startNetworkMonitoring(): void {
  if (started) return;
  started = true;

  Network.getNetworkStateAsync().then((state) => {
    isWifi = state.type === Network.NetworkStateType.WIFI;
  });

  Network.addNetworkStateListener((state) => {
    isWifi = state.type === Network.NetworkStateType.WIFI;
  });
}
