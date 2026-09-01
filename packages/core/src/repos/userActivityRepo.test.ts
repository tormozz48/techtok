import { beforeEach, describe, expect, it } from 'vitest';
import { createTestDb, type TestSqlClient } from '../db/testDb';
import { UserActivityRepo } from './userActivityRepo';

let db: TestSqlClient;
let repo: UserActivityRepo;

const snapshot = { cardTitle: 'Title', sourceName: 'Hacker News', url: 'https://example.com/a' };

async function seedUser(userId: string): Promise<void> {
  await db.execute(
    `insert into users (user_id, created_at, last_seen_at) values ('${userId}', now()::text, now()::text)`,
  );
}

beforeEach(async () => {
  db = await createTestDb();
  repo = new UserActivityRepo(db);
  await seedUser('device-1');
});

describe('userActivityRepo.markRead', () => {
  it('stores a read marker with the given snapshot and readAt', async () => {
    await repo.markRead('device-1', 'abc123', snapshot, '2026-07-18T00:00:00.000Z');

    const readSet = await repo.getReadSet('device-1', ['abc123']);
    expect(readSet).toEqual(new Set(['abc123']));
  });

  it('reports wasNew: true when no prior read-marker existed', async () => {
    const result = await repo.markRead('device-1', 'abc123', snapshot);

    expect(result).toEqual({ wasNew: true });
  });

  it('reports wasNew: false when a read-marker already existed (retry/re-read)', async () => {
    await repo.markRead('device-1', 'abc123', snapshot);

    const result = await repo.markRead('device-1', 'abc123', snapshot);

    expect(result).toEqual({ wasNew: false });
  });

  it('refreshes readAt and the snapshot on a re-read', async () => {
    await repo.markRead('device-1', 'abc123', snapshot, '2026-07-18T00:00:00.000Z');

    await repo.markRead(
      'device-1',
      'abc123',
      { ...snapshot, cardTitle: 'Updated title' },
      '2026-07-19T00:00:00.000Z',
    );

    const page = await repo.queryHistory('device-1');
    expect(page.items).toEqual([
      {
        userId: 'device-1',
        postId: 'abc123',
        readAt: '2026-07-19T00:00:00.000Z',
        snapshot: { ...snapshot, cardTitle: 'Updated title' },
      },
    ]);
  });
});

describe('userActivityRepo.getReadSet', () => {
  it('returns an empty set without querying when given no ids', async () => {
    expect(await repo.getReadSet('device-1', [])).toEqual(new Set());
  });

  it('returns only the read postIds among those asked about', async () => {
    await repo.markRead('device-1', 'abc123', snapshot);

    const readIds = await repo.getReadSet('device-1', ['abc123', 'def456']);

    expect(readIds).toEqual(new Set(['abc123']));
  });
});

describe('userActivityRepo.queryHistory', () => {
  it('returns items newest-first with a null cursor when exhausted', async () => {
    await repo.markRead('device-1', 'a', snapshot, '2026-07-18T00:00:00.000Z');
    await repo.markRead('device-1', 'b', snapshot, '2026-07-19T00:00:00.000Z');

    const page = await repo.queryHistory('device-1', { limit: 10 });

    expect(page.items.map((i) => i.postId)).toEqual(['b', 'a']);
    expect(page.nextCursor).toBeNull();
  });

  it('paginates via an opaque cursor, tie-broken by postId on equal timestamps', async () => {
    await repo.markRead('device-1', 'a', snapshot, '2026-07-18T00:00:00.000Z');
    await repo.markRead('device-1', 'b', snapshot, '2026-07-18T00:00:00.000Z');
    await repo.markRead('device-1', 'c', snapshot, '2026-07-18T00:00:00.000Z');

    const first = await repo.queryHistory('device-1', { limit: 2 });
    expect(first.items.map((i) => i.postId)).toEqual(['c', 'b']);
    expect(first.nextCursor).not.toBeNull();

    const second = await repo.queryHistory('device-1', {
      limit: 2,
      cursor: first.nextCursor ?? undefined,
    });
    expect(second.items.map((i) => i.postId)).toEqual(['a']);
    expect(second.nextCursor).toBeNull();
  });

  it('filters by q against cardTitle and sourceName, case-insensitively', async () => {
    await repo.markRead('device-1', 'a', { ...snapshot, cardTitle: 'A great story about AI' });
    await repo.markRead('device-1', 'b', { ...snapshot, cardTitle: 'Something else entirely' });

    const page = await repo.queryHistory('device-1', { q: 'great STORY' });

    expect(page.items.map((i) => i.postId)).toEqual(['a']);
  });

  it('treats % and _ in q as literal characters, not SQL wildcards', async () => {
    await repo.markRead('device-1', 'a', { ...snapshot, cardTitle: '50% off_sale' });
    await repo.markRead('device-1', 'b', { ...snapshot, cardTitle: 'anything at all' });

    const page = await repo.queryHistory('device-1', { q: '50% off_sale' });

    expect(page.items.map((i) => i.postId)).toEqual(['a']);
  });
});

describe('userActivityRepo.addBookmark / removeBookmark', () => {
  it('adds a bookmark retrievable via getBookmarkSet', async () => {
    await repo.addBookmark('device-1', 'abc123', snapshot, '2026-07-18T00:00:00.000Z');

    expect(await repo.getBookmarkSet('device-1', ['abc123'])).toEqual(new Set(['abc123']));
  });

  it('removes a bookmark', async () => {
    await repo.addBookmark('device-1', 'abc123', snapshot);

    await repo.removeBookmark('device-1', 'abc123');

    expect(await repo.getBookmarkSet('device-1', ['abc123'])).toEqual(new Set());
  });
});

describe('userActivityRepo.getBookmarkSet', () => {
  it('returns an empty set without querying when given no ids', async () => {
    expect(await repo.getBookmarkSet('device-1', [])).toEqual(new Set());
  });
});

describe('userActivityRepo.queryBookmarks', () => {
  it('returns items newest-first with a null cursor when exhausted', async () => {
    await repo.addBookmark('device-1', 'a', snapshot, '2026-07-18T00:00:00.000Z');
    await repo.addBookmark('device-1', 'b', snapshot, '2026-07-19T00:00:00.000Z');

    const page = await repo.queryBookmarks('device-1', { limit: 10 });

    expect(page.items.map((i) => i.postId)).toEqual(['b', 'a']);
    expect(page.nextCursor).toBeNull();
  });
});

describe('userActivityRepo.deleteAllForUser', () => {
  it('deletes both reads and bookmarks for the user', async () => {
    await repo.markRead('device-1', 'a', snapshot);
    await repo.addBookmark('device-1', 'b', snapshot);

    await repo.deleteAllForUser('device-1');

    expect(await repo.getReadSet('device-1', ['a'])).toEqual(new Set());
    expect(await repo.getBookmarkSet('device-1', ['b'])).toEqual(new Set());
  });

  it('does nothing when the user has no rows', async () => {
    await expect(repo.deleteAllForUser('device-1')).resolves.toBeUndefined();
  });
});
