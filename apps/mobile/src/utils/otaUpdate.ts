export type ForegroundAction = 'reload' | 'check' | 'ignore';

export const MIN_BACKGROUND_MS = 5 * 60_000;

export type ForegroundInput = {
  isUpdatePending: boolean;
  backgroundedAtMs: number | null;
  nowMs: number;
  isSignedIn: boolean;
};

export function decideOnForeground(input: ForegroundInput): ForegroundAction {
  if (input.backgroundedAtMs === null) return 'ignore';
  if (input.nowMs - input.backgroundedAtMs < MIN_BACKGROUND_MS) return 'ignore';
  if (input.isUpdatePending && input.isSignedIn) return 'reload';
  return 'check';
}
