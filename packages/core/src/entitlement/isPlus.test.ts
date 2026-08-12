import { describe, expect, it } from 'vitest';
import { isPlus } from './isPlus';

const NOW = new Date('2026-08-12T12:00:00.000Z');

describe('isPlus', () => {
  it('returns false when there is no entitlement at all', () => {
    expect(isPlus({}, NOW)).toBe(false);
  });

  it('returns false when the plan is free', () => {
    expect(
      isPlus(
        { entitlement: { plan: 'free', source: 'manual', verifiedAt: NOW.toISOString() } },
        NOW,
      ),
    ).toBe(false);
  });

  it('returns true for a plus entitlement with no expiresAt (open-ended manual grant)', () => {
    expect(
      isPlus(
        { entitlement: { plan: 'plus', source: 'manual', verifiedAt: NOW.toISOString() } },
        NOW,
      ),
    ).toBe(true);
  });

  it('returns true for a plus entitlement that expires in the future', () => {
    expect(
      isPlus(
        {
          entitlement: {
            plan: 'plus',
            source: 'play',
            expiresAt: '2026-09-01T00:00:00.000Z',
            verifiedAt: NOW.toISOString(),
          },
        },
        NOW,
      ),
    ).toBe(true);
  });

  it('returns false for a plus entitlement that already expired', () => {
    expect(
      isPlus(
        {
          entitlement: {
            plan: 'plus',
            source: 'play',
            expiresAt: '2026-08-01T00:00:00.000Z',
            verifiedAt: NOW.toISOString(),
          },
        },
        NOW,
      ),
    ).toBe(false);
  });
});
