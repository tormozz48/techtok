/** Clock skew between this device and the API is unbounded, so fire a beat
 * *after* the boundary rather than exactly on it — a device running ahead
 * would otherwise refetch before the server's own day has rolled over and
 * get the same exhausted answer back. */
const SKEW_BUFFER_MS = 5_000;

/**
 * Milliseconds from `now` until the daily-quota reset instant `resetsAt`
 * (D69's next local midnight, as reported by `GET /v1/me/entitlement` and by
 * an exhausted feed page). Zero or negative means the boundary has already
 * passed; `undefined` means there is nothing to wait for — no `resetsAt`, or
 * a value that isn't a parseable date.
 */
export function msUntilQuotaReset(
  resetsAt: string | undefined,
  now: number = Date.now(),
): number | undefined {
  if (!resetsAt) return undefined;
  const at = new Date(resetsAt).getTime();
  if (Number.isNaN(at)) return undefined;
  return at + SKEW_BUFFER_MS - now;
}
