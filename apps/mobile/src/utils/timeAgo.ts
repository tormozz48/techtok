const MINUTE = 60;
const HOUR = MINUTE * 60;
const DAY = HOUR * 24;
const WEEK = DAY * 7;

/** Terse TikTok-style relative time — "3h ago", not "3 hours ago". */
export function timeAgo(iso: string, now: Date = new Date()): string {
  const seconds = Math.max(0, Math.round((now.getTime() - new Date(iso).getTime()) / 1000));

  if (seconds < MINUTE) return 'just now';
  if (seconds < HOUR) return `${Math.floor(seconds / MINUTE)}m ago`;
  if (seconds < DAY) return `${Math.floor(seconds / HOUR)}h ago`;
  if (seconds < WEEK) return `${Math.floor(seconds / DAY)}d ago`;
  return `${Math.floor(seconds / WEEK)}w ago`;
}
