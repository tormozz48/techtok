import type { UserRecord } from '@techtok/core';
import { describe, expect, it } from 'vitest';
import { toEntitlementResponse } from './toEntitlementResponse';

const NOW = new Date('2026-08-12T10:00:00.000Z');

function baseUser(overrides: Partial<UserRecord> = {}): UserRecord {
  return {
    userId: 'device-1',
    topics: [],
    createdAt: '2026-07-18T00:00:00.000Z',
    lastSeenAt: '2026-07-19T00:00:00.000Z',
    ...overrides,
  };
}

describe('toEntitlementResponse', () => {
  it('reports plan free with zero quota usage for a brand-new user', () => {
    const response = toEntitlementResponse(baseUser(), NOW);

    expect(response).toEqual({
      plan: 'free',
      expiresAt: undefined,
      quota: {
        cardReads: 0,
        cardReadsLimit: 100,
        readerOpens: 0,
        readerOpensLimit: 20,
        resetsAt: '2026-08-13T00:00:00.000Z',
      },
    });
  });

  it("carries through today's in-progress quota usage", () => {
    const user = baseUser({
      timezone: 'UTC',
      quota: { day: '2026-08-12', cardReads: 12, readerOpens: 4 },
    });

    const response = toEntitlementResponse(user, NOW);

    expect(response.quota).toMatchObject({ cardReads: 12, readerOpens: 4 });
  });

  it('rolls a stale quota (yesterday) over to zero without mutating anything', () => {
    const user = baseUser({
      timezone: 'UTC',
      quota: { day: '2026-08-11', cardReads: 50, readerOpens: 10 },
    });

    const response = toEntitlementResponse(user, NOW);

    expect(response.quota).toMatchObject({ cardReads: 0, readerOpens: 0 });
  });

  it('reports plan plus and carries expiresAt for an active entitlement', () => {
    const user = baseUser({
      entitlement: {
        plan: 'plus',
        source: 'manual',
        expiresAt: '2026-09-01T00:00:00.000Z',
        verifiedAt: '2026-08-01T00:00:00.000Z',
      },
    });

    const response = toEntitlementResponse(user, NOW);

    expect(response.plan).toBe('plus');
    expect(response.expiresAt).toBe('2026-09-01T00:00:00.000Z');
  });

  it('reports plan free once an entitlement has expired', () => {
    const user = baseUser({
      entitlement: {
        plan: 'plus',
        source: 'play',
        expiresAt: '2026-08-01T00:00:00.000Z',
        verifiedAt: '2026-07-01T00:00:00.000Z',
      },
    });

    expect(toEntitlementResponse(user, NOW).plan).toBe('free');
  });

  it("computes resetsAt from the user's own timezone, not UTC", () => {
    const user = baseUser({ timezone: 'America/New_York' });

    const response = toEntitlementResponse(user, NOW);

    // Local midnight of Aug 13 in New York (UTC-4 in August) is 04:00 UTC on Aug 13.
    expect(response.quota.resetsAt).toBe('2026-08-13T04:00:00.000Z');
  });
});
