import * as Network from 'expo-network';

let isWifi = false;

export function getIsWifi(): boolean {
  return isWifi;
}

let started = false;

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
