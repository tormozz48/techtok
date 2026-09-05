import { describe, expect, it } from 'vitest';
import { decideOnForeground, MIN_BACKGROUND_MS } from './otaUpdate';

const NOW = 1_700_000_000_000;

function input(overrides: Partial<Parameters<typeof decideOnForeground>[0]> = {}) {
  return {
    isUpdatePending: false,
    backgroundedAtMs: NOW - MIN_BACKGROUND_MS,
    nowMs: NOW,
    isSignedIn: true,
    ...overrides,
  };
}

describe('decideOnForeground', () => {
  it('ignores an activation that was never preceded by a background', () => {
    expect(decideOnForeground(input({ backgroundedAtMs: null, isUpdatePending: true }))).toBe(
      'ignore',
    );
  });

  it('ignores a short excursion so sign-in and article reading are never interrupted', () => {
    expect(
      decideOnForeground(input({ backgroundedAtMs: NOW - 30_000, isUpdatePending: true })),
    ).toBe('ignore');
  });

  it('reloads when a downloaded update is pending after a long absence', () => {
    expect(decideOnForeground(input({ isUpdatePending: true }))).toBe('reload');
  });

  it('checks instead of reloading when nothing is pending', () => {
    expect(decideOnForeground(input())).toBe('check');
  });

  it('does not reload a signed-out session, where the absence may be an auth handoff', () => {
    expect(decideOnForeground(input({ isUpdatePending: true, isSignedIn: false }))).toBe('check');
  });
});
