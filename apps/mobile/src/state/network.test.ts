jest.mock('expo-network', () => ({
  NetworkStateType: { WIFI: 'WIFI', CELLULAR: 'CELLULAR', NONE: 'NONE', UNKNOWN: 'UNKNOWN' },
  getNetworkStateAsync: jest.fn(),
  addNetworkStateListener: jest.fn(),
}));

describe('network', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  it('reflects the initial network state once resolved', async () => {
    const Network = require('expo-network');
    (Network.getNetworkStateAsync as jest.Mock).mockResolvedValue({ type: 'WIFI' });
    (Network.addNetworkStateListener as jest.Mock).mockImplementation(() => ({ remove() {} }));
    const { getIsWifi, startNetworkMonitoring } = require('./network');

    startNetworkMonitoring();
    await Promise.resolve();
    await Promise.resolve();

    expect(getIsWifi()).toBe(true);
  });

  it('updates when the listener fires with a non-wifi state', () => {
    const Network = require('expo-network');
    let listener: ((event: { type: string }) => void) | undefined;
    (Network.addNetworkStateListener as jest.Mock).mockImplementation((cb: typeof listener) => {
      listener = cb;
      return { remove() {} };
    });
    (Network.getNetworkStateAsync as jest.Mock).mockResolvedValue({ type: 'WIFI' });
    const { getIsWifi, startNetworkMonitoring } = require('./network');

    startNetworkMonitoring();
    listener?.({ type: 'CELLULAR' });

    expect(getIsWifi()).toBe(false);
  });

  it('is idempotent — a second call does not re-register the listener', () => {
    const Network = require('expo-network');
    (Network.getNetworkStateAsync as jest.Mock).mockResolvedValue({ type: 'WIFI' });
    (Network.addNetworkStateListener as jest.Mock).mockImplementation(() => ({ remove() {} }));
    const { startNetworkMonitoring } = require('./network');

    startNetworkMonitoring();
    startNetworkMonitoring();

    expect(Network.addNetworkStateListener).toHaveBeenCalledTimes(1);
  });
});
