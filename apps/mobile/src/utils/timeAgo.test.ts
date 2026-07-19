import { timeAgo } from './timeAgo';

const NOW = new Date('2026-07-18T12:00:00.000Z');

describe('timeAgo', () => {
  it('returns "just now" for under a minute', () => {
    expect(timeAgo('2026-07-18T11:59:30.000Z', NOW)).toBe('just now');
  });

  it('formats minutes', () => {
    expect(timeAgo('2026-07-18T11:45:00.000Z', NOW)).toBe('15m ago');
  });

  it('formats hours', () => {
    expect(timeAgo('2026-07-18T09:00:00.000Z', NOW)).toBe('3h ago');
  });

  it('formats days', () => {
    expect(timeAgo('2026-07-15T12:00:00.000Z', NOW)).toBe('3d ago');
  });

  it('formats weeks', () => {
    expect(timeAgo('2026-06-27T12:00:00.000Z', NOW)).toBe('3w ago');
  });

  it('clamps a future timestamp to "just now" instead of going negative', () => {
    expect(timeAgo('2026-07-18T13:00:00.000Z', NOW)).toBe('just now');
  });
});
