const SKEW_BUFFER_MS = 5_000;

export function msUntilQuotaReset(
  resetsAt: string | undefined,
  now: number = Date.now(),
): number | undefined {
  if (!resetsAt) return undefined;
  const at = new Date(resetsAt).getTime();
  if (Number.isNaN(at)) return undefined;
  return at + SKEW_BUFFER_MS - now;
}

export function hasQuotaResetPassed(
  resetsAt: string | undefined,
  now: number = Date.now(),
): boolean {
  const remaining = msUntilQuotaReset(resetsAt, now);
  return remaining !== undefined && remaining <= 0;
}
