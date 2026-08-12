import { describe, expect, it } from 'vitest';
import { effectiveQuota, localDayKey, nextLocalMidnightUtc } from './quota';

describe('localDayKey', () => {
  it('returns the UTC calendar day for the UTC timezone', () => {
    expect(localDayKey('UTC', new Date('2026-08-12T23:30:00.000Z'))).toBe('2026-08-12');
  });

  it('rolls over into the next calendar day for a positive-offset timezone', () => {
    // Europe/Warsaw is UTC+2 in August (DST) -> 23:30 UTC is already 01:30 the next day locally.
    expect(localDayKey('Europe/Warsaw', new Date('2026-08-12T23:30:00.000Z'))).toBe('2026-08-13');
  });

  it('falls back to UTC for an invalid timezone rather than throwing', () => {
    expect(localDayKey('not/a-real-zone', new Date('2026-08-12T23:30:00.000Z'))).toBe('2026-08-12');
  });
});

describe('nextLocalMidnightUtc', () => {
  it('returns the next UTC midnight for the UTC timezone', () => {
    const result = nextLocalMidnightUtc('UTC', new Date('2026-08-12T10:00:00.000Z'));
    expect(result.toISOString()).toBe('2026-08-13T00:00:00.000Z');
  });

  it('accounts for a positive DST offset (Europe/Warsaw, UTC+2 in August)', () => {
    const result = nextLocalMidnightUtc('Europe/Warsaw', new Date('2026-08-12T10:00:00.000Z'));
    // Local midnight of Aug 13 in Warsaw (UTC+2) is 22:00 UTC on Aug 12.
    expect(result.toISOString()).toBe('2026-08-12T22:00:00.000Z');
  });

  it('accounts for a negative offset (America/New_York, UTC-4 in August)', () => {
    const result = nextLocalMidnightUtc('America/New_York', new Date('2026-08-12T10:00:00.000Z'));
    // Local midnight of Aug 13 in New York (UTC-4) is 04:00 UTC on Aug 13.
    expect(result.toISOString()).toBe('2026-08-13T04:00:00.000Z');
  });
});

describe('effectiveQuota', () => {
  const now = new Date('2026-08-12T10:00:00.000Z');

  it('returns a fresh zero-count quota when none exists yet', () => {
    expect(effectiveQuota(undefined, 'UTC', now)).toEqual({
      day: '2026-08-12',
      cardReads: 0,
      readerOpens: 0,
    });
  });

  it('returns the stored quota unchanged when its day matches today', () => {
    const stored = { day: '2026-08-12', cardReads: 12, readerOpens: 3 };
    expect(effectiveQuota(stored, 'UTC', now)).toEqual(stored);
  });

  it('rolls a stale quota over to a fresh zero-count day', () => {
    const stale = { day: '2026-08-11', cardReads: 50, readerOpens: 10 };
    expect(effectiveQuota(stale, 'UTC', now)).toEqual({
      day: '2026-08-12',
      cardReads: 0,
      readerOpens: 0,
    });
  });
});
