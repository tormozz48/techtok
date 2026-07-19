import { getOrCreateDeviceId } from './deviceId';

describe('getOrCreateDeviceId', () => {
  it('returns the same id on repeated calls', () => {
    const first = getOrCreateDeviceId();
    const second = getOrCreateDeviceId();
    expect(second).toBe(first);
  });

  it('generates a v4-shaped uuid', () => {
    const id = getOrCreateDeviceId();
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
  });
});
