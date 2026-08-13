import type { Quota } from './entitlement.types';

/** Returns `timezone`'s current calendar day as `YYYY-MM-DD`, or UTC's if
 * `timezone` isn't a valid IANA zone (a malformed `X-Device-Timezone` header
 * value never reaches this point per `extractDeviceTimezone`'s own shape
 * check, but a stored value could still be corrupted by hand — degrade
 * rather than throw). `en-CA` is the one common locale whose default date
 * format is already `YYYY-MM-DD`. */
export function localDayKey(timezone: string, now: Date = new Date()): string {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(now);
  } catch {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'UTC' }).format(now);
  }
}

function tzOffsetMinutes(instant: Date, timezone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    timeZoneName: 'longOffset',
  }).formatToParts(instant);
  const offset = parts.find((p) => p.type === 'timeZoneName')?.value ?? 'GMT+00:00';
  const match = /GMT([+-])(\d{2}):(\d{2})/.exec(offset);
  if (!match) return 0;
  const sign = match[1] === '-' ? -1 : 1;
  return sign * (Number(match[2]) * 60 + Number(match[3]));
}

/**
 * The next local-midnight instant in `timezone`, as an ISO UTC string —
 * the `resetsAt` this stage's daily quota and entitlement responses report.
 * Standard two-pass timezone-conversion trick: build a naive UTC instant
 * from tomorrow's calendar digits, then correct it by that instant's actual
 * UTC offset in `timezone`. Off by up to the DST delta (~1h) on the two
 * days per year a DST transition happens to land exactly on this
 * calculation — an accepted imprecision, same spirit as the feed cursor's
 * own documented tolerance (DESIGN §5.2).
 */
export function nextLocalMidnightUtc(timezone: string, now: Date = new Date()): Date {
  const today = localDayKey(timezone, now);
  const parts = today.split('-').map(Number);
  const year = parts[0] ?? now.getUTCFullYear();
  const month = parts[1] ?? now.getUTCMonth() + 1;
  const day = parts[2] ?? now.getUTCDate();
  const naiveNextMidnightUtc = new Date(Date.UTC(year, month - 1, day + 1, 0, 0, 0));
  const offsetMinutes = tzOffsetMinutes(naiveNextMidnightUtc, timezone);
  return new Date(naiveNextMidnightUtc.getTime() - offsetMinutes * 60_000);
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
