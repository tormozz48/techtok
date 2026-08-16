import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';
import type { Quota } from './entitlement.types';

/** Returns `timezone`'s current calendar day as `YYYY-MM-DD`, or UTC's if
 * `timezone` isn't a valid IANA zone (a malformed `X-Device-Timezone` header
 * value never reaches this point per `extractDeviceTimezone`'s own shape
 * check, but a stored value could still be corrupted by hand — degrade
 * rather than throw). */
export function localDayKey(timezone: string, now: Date = new Date()): string {
  try {
    return formatInTimeZone(now, timezone, 'yyyy-MM-dd');
  } catch {
    return formatInTimeZone(now, 'UTC', 'yyyy-MM-dd');
  }
}

/**
 * The next local-midnight instant in `timezone`, as an ISO UTC string —
 * the `resetsAt` this stage's daily quota and entitlement responses report.
 * Builds tomorrow's calendar-day digits with plain UTC arithmetic (pure
 * integer math, no timezone semantics involved — `date-fns`'s own
 * day-arithmetic helpers read/write local wall-clock fields and would make
 * this depend on the running process's system timezone), then hands that
 * wall-clock date to `date-fns-tz`'s `fromZonedTime` for the actual
 * IANA/DST-aware conversion to a UTC instant.
 */
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

/** Read-only view of a user's quota "as of now" — rolls a stale or absent
 * `quota` over to a fresh zero-count day without writing anything. Used by
 * every read-side quota check (the feed's pre-page gate, the entitlement
 * response) so they never need to know the increment-side rollover logic in
 * `UsersRepo`. */
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
