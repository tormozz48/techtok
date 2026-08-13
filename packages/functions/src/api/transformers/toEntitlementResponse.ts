import {
  effectiveQuota,
  FREE_CARD_READS_PER_DAY,
  FREE_READER_OPENS_PER_DAY,
  isPlus,
  nextLocalMidnightUtc,
  type UserRecord,
} from '@techtok/core';
import type { EntitlementResponse } from '@techtok/shared';

/**
 * `GET /v1/me/entitlement` (D69/D70) — the one call every paywall surface
 * reads from. Limits are always the free-tier constants regardless of plan;
 * the client treats `plan === 'plus'` as "ignore the limit", the same way
 * the server itself does in the feed/content quota gates.
 */
export function toEntitlementResponse(
  user: UserRecord,
  now: Date = new Date(),
): EntitlementResponse {
  const timezone = user.timezone ?? 'UTC';
  const quota = effectiveQuota(user.quota, timezone, now);

  return {
    plan: isPlus(user, now) ? 'plus' : 'free',
    expiresAt: user.entitlement?.expiresAt,
    quota: {
      cardReads: quota.cardReads,
      cardReadsLimit: FREE_CARD_READS_PER_DAY,
      readerOpens: quota.readerOpens,
      readerOpensLimit: FREE_READER_OPENS_PER_DAY,
      resetsAt: nextLocalMidnightUtc(timezone, now).toISOString(),
    },
  };
}
