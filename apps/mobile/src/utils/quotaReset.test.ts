import { msUntilQuotaReset } from './quotaReset';

const NOW = new Date('2026-08-21T21:00:00.000Z').getTime();

describe('msUntilQuotaReset', () => {
  it('returns the remaining time until a future boundary, plus a skew buffer', () => {
    expect(msUntilQuotaReset('2026-08-21T22:00:00.000Z', NOW)).toBe(60 * 60 * 1000 + 5_000);
  });

  it('returns a non-positive value once the boundary has passed', () => {
    expect(msUntilQuotaReset('2026-08-21T20:00:00.000Z', NOW)).toBeLessThanOrEqual(0);
  });

  it('still counts a boundary inside the skew buffer as not yet passed', () => {
    expect(msUntilQuotaReset('2026-08-21T20:59:58.000Z', NOW)).toBeGreaterThan(0);
  });

  it('returns undefined when there is no boundary to wait for', () => {
    expect(msUntilQuotaReset(undefined, NOW)).toBeUndefined();
  });

  it('returns undefined for an unparseable boundary rather than scheduling on NaN', () => {
    expect(msUntilQuotaReset('not-a-date', NOW)).toBeUndefined();
  });
});
