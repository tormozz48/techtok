import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';
import type { Quota } from './entitlement.types';
import { FREE_CARD_READS_PER_DAY } from './entitlement.types';

export function localDayKey(timezone: string, now: Date = new Date()): string {
  try {
    return formatInTimeZone(now, timezone, 'yyyy-MM-dd');
  } catch {
    return formatInTimeZone(now, 'UTC', 'yyyy-MM-dd');
  }
}

export function nextLocalMidnightUtc(timezone: string, now: Date = new Date()): Date {
  const today = localDayKey(timezone, now);
  const parts = today.split('-').map(Number);
  const year = parts[0] ?? now.getUTCFullYear();
  const month = parts[1] ?? now.getUTCMonth() + 1;
  const day = parts[2] ?? now.getUTCDate();
  const tomorrow = formatInTimeZone(
    new Date(Date.UTC(year, month - 1, day + 1)),
    'UTC',
    'yyyy-MM-dd',
  );
  return fromZonedTime(`${tomorrow}T00:00:00`, timezone);
}

export function effectiveQuota(
  quota: Quota | undefined,
  timezone: string,
  now: Date = new Date(),
): Quota {
  const today = localDayKey(timezone, now);
  if (!quota || quota.day !== today) {
    return { day: today, cardReads: 0, readerOpens: 0 };
  }
  return quota;
}

export function chargeableCardReads(quota: Quota, requestedCount: number): number {
  const remaining = Math.max(0, FREE_CARD_READS_PER_DAY - quota.cardReads);
  return Math.min(requestedCount, remaining);
}
