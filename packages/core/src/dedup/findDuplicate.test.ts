import { describe, expect, it, vi } from 'vitest';
import { type DuplicateCandidate, findDuplicateOf } from './findDuplicate';

function candidate(overrides: Partial<DuplicateCandidate> = {}): DuplicateCandidate {
  return {
    postId: 'new1',
    sourceId: 'verge',
    origTitle: 'FBI stops investigating ICE agents',
    primaryTopic: 'security',
    publishedAt: '2026-07-19T12:00:00.000Z',
    ...overrides,
  };
}

describe('findDuplicateOf', () => {
  it('returns undefined when there are no recent candidates', async () => {
    const queryRecentByTopic = vi.fn().mockResolvedValue([]);

    const result = await findDuplicateOf(candidate(), { queryRecentByTopic });

    expect(result).toBeUndefined();
  });

  it('matches a similar title from a different source within the window', async () => {
    const existing = candidate({
      postId: 'existing1',
      sourceId: 'arstechnica',
      origTitle: 'FBI stops investigating ICE agents, report says',
      publishedAt: '2026-07-19T10:00:00.000Z',
    });
    const queryRecentByTopic = vi.fn().mockResolvedValue([existing]);

    const result = await findDuplicateOf(candidate(), { queryRecentByTopic });

    expect(result).toBe('existing1');
  });

  it('ignores a match from the same source', async () => {
    const sameSource = candidate({
      postId: 'existing1',
      sourceId: 'verge',
      origTitle: 'FBI stops investigating ICE agents',
      publishedAt: '2026-07-19T10:00:00.000Z',
    });
    const queryRecentByTopic = vi.fn().mockResolvedValue([sameSource]);

    const result = await findDuplicateOf(candidate(), { queryRecentByTopic });

    expect(result).toBeUndefined();
  });

  it('ignores itself when it appears in the recent-posts window', async () => {
    const self = candidate();
    const queryRecentByTopic = vi.fn().mockResolvedValue([self]);

    const result = await findDuplicateOf(candidate(), { queryRecentByTopic });

    expect(result).toBeUndefined();
  });

  it('ignores a similar title published outside the time window', async () => {
    const tooOld = candidate({
      postId: 'existing1',
      sourceId: 'arstechnica',
      origTitle: 'FBI stops investigating ICE agents',
      publishedAt: '2026-07-15T12:00:00.000Z',
    });
    const queryRecentByTopic = vi.fn().mockResolvedValue([tooOld]);

    const result = await findDuplicateOf(candidate(), { queryRecentByTopic });

    expect(result).toBeUndefined();
  });

  it('ignores an unrelated title within the window', async () => {
    const unrelated = candidate({
      postId: 'existing1',
      sourceId: 'arstechnica',
      origTitle: 'A completely different story about bakeries',
      publishedAt: '2026-07-19T10:00:00.000Z',
    });
    const queryRecentByTopic = vi.fn().mockResolvedValue([unrelated]);

    const result = await findDuplicateOf(candidate(), { queryRecentByTopic });

    expect(result).toBeUndefined();
  });

  it('resolves to the chain root when the matched post is itself already a duplicate', async () => {
    const alreadyADuplicate = candidate({
      postId: 'existing1',
      sourceId: 'arstechnica',
      origTitle: 'FBI stops investigating ICE agents, report says',
      publishedAt: '2026-07-19T10:00:00.000Z',
      duplicateOf: 'root',
    });
    const queryRecentByTopic = vi.fn().mockResolvedValue([alreadyADuplicate]);

    const result = await findDuplicateOf(candidate(), { queryRecentByTopic });

    expect(result).toBe('root');
  });

  it('honors a custom window and threshold', async () => {
    const borderline = candidate({
      postId: 'existing1',
      sourceId: 'arstechnica',
      origTitle: 'FBI stops investigating ICE agents, report says',
      publishedAt: '2026-07-17T12:00:00.000Z',
    });
    const queryRecentByTopic = vi.fn().mockResolvedValue([borderline]);

    const withDefaultWindow = await findDuplicateOf(candidate(), { queryRecentByTopic });
    const withNarrowWindow = await findDuplicateOf(
      candidate(),
      { queryRecentByTopic },
      { windowHours: 1 },
    );

    expect(withDefaultWindow).toBe('existing1');
    expect(withNarrowWindow).toBeUndefined();
  });
});
