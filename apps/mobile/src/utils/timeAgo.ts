import type { ChromeStrings } from '@/i18n/strings';

const MINUTE = 60;
const HOUR = MINUTE * 60;
const DAY = HOUR * 24;
const WEEK = DAY * 7;

/** Terse TikTok-style relative time — "3h ago", not "3 hours ago". */
export function timeAgo(
  iso: string,
  strings: ChromeStrings['time'],
  now: Date = new Date(),
): string {
  const seconds = Math.max(0, Math.round((now.getTime() - new Date(iso).getTime()) / 1000));

  if (seconds < MINUTE) return strings.justNow;
  if (seconds < HOUR) return strings.minutesAgo(Math.floor(seconds / MINUTE));
  if (seconds < DAY) return strings.hoursAgo(Math.floor(seconds / HOUR));
  if (seconds < WEEK) return strings.daysAgo(Math.floor(seconds / DAY));
  return strings.weeksAgo(Math.floor(seconds / WEEK));
}
