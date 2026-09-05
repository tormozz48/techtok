import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

vi.mock('expo-network', () => ({
  NetworkStateType: { WIFI: 'WIFI', CELLULAR: 'CELLULAR', NONE: 'NONE', UNKNOWN: 'UNKNOWN' },
  getNetworkStateAsync: vi.fn(),
  addNetworkStateListener: vi.fn(),
}));

describe('network', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('reflects the initial network state once resolved', async () => {
    const Network = await import('expo-network');
    (Network.getNetworkStateAsync as Mock).mockResolvedValue({ type: 'WIFI' });
    (Network.addNetworkStateListener as Mock).mockImplementation(() => ({ remove() {} }));
    const { getIsWifi, startNetworkMonitoring } = await import('./network');

    startNetworkMonitoring();
    await Promise.resolve();
    await Promise.resolve();

    expect(getIsWifi()).toBe(true);
  });

  it('updates when the listener fires with a non-wifi state', async () => {
    const Network = await import('expo-network');
    let listener: ((event: { type: string }) => void) | undefined;
    (Network.addNetworkStateListener as Mock).mockImplementation((cb: typeof listener) => {
      listener = cb;
      return { remove() {} };
    });
    (Network.getNetworkStateAsync as Mock).mockResolvedValue({ type: 'WIFI' });
    const { getIsWifi, startNetworkMonitoring } = await import('./network');

    startNetworkMonitoring();
    listener?.({ type: 'CELLULAR' });

    expect(getIsWifi()).toBe(false);
  });

  it('is idempotent — a second call does not re-register the listener', async () => {
    const Network = await import('expo-network');
    (Network.getNetworkStateAsync as Mock).mockResolvedValue({ type: 'WIFI' });
    (Network.addNetworkStateListener as Mock).mockImplementation(() => ({ remove() {} }));
    const { startNetworkMonitoring } = await import('./network');

    startNetworkMonitoring();
    startNetworkMonitoring();

    expect(Network.addNetworkStateListener).toHaveBeenCalledTimes(1);
  });
});
