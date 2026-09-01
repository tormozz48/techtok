import { beforeEach, describe, expect, it } from 'vitest';
import { sources } from '../db/schema';
import { createTestDb, type TestSqlClient } from '../db/testDb';
import { UsersRepo } from './usersRepo';

async function seedSource(db: TestSqlClient, sourceId: string): Promise<void> {
  await db.insert(sources).values({
    sourceId,
    name: sourceId,
    rssUrl: `https://example.com/${sourceId}/rss`,
    defaultTopic: 'dev',
    weight: 1,
    enabled: true,
  });
}

let db: TestSqlClient;
let repo: UsersRepo;

beforeEach(async () => {
  db = await createTestDb();
  repo = new UsersRepo(db);
});

describe('usersRepo.touch', () => {
  it('creates a new user seeded with language/timezone defaults', async () => {
    const user = await repo.touch('device-1');

    expect(user.userId).toBe('device-1');
    expect(user.language).toBe('en');
    expect(user.timezone).toBe('UTC');
    expect(user.topics).toEqual([]);
    expect(user.createdAt).toBe(user.lastSeenAt);
  });

  it('seeds language and timezone from the given opts on first touch', async () => {
    const user = await repo.touch('device-1', { deviceLanguage: 'uk', timezone: 'Europe/Kyiv' });

    expect(user.language).toBe('uk');
    expect(user.timezone).toBe('Europe/Kyiv');
  });

  it('never overwrites language/timezone/createdAt on a later touch', async () => {
    const first = await repo.touch('device-1', { deviceLanguage: 'uk', timezone: 'Europe/Kyiv' });
    const second = await repo.touch('device-1', {
      deviceLanguage: 'pl',
      timezone: 'Europe/Warsaw',
    });

    expect(second.language).toBe('uk');
    expect(second.timezone).toBe('Europe/Kyiv');
    expect(second.createdAt).toBe(first.createdAt);
    expect(second.lastSeenAt >= first.lastSeenAt).toBe(true);
  });

  it('sets email/name unconditionally when given', async () => {
    const user = await repo.touch('device-1', { email: 'ada@example.com', name: 'Ada' });

    expect(user.email).toBe('ada@example.com');
    expect(user.name).toBe('Ada');
  });

  it('leaves email/name untouched when not given on a later touch', async () => {
    await repo.touch('device-1', { email: 'ada@example.com', name: 'Ada' });

    const user = await repo.touch('device-1');

    expect(user.email).toBe('ada@example.com');
    expect(user.name).toBe('Ada');
  });

  it('omits email/name entirely when never given', async () => {
    const user = await repo.touch('device-1');

    expect(user.email).toBeUndefined();
    expect(user.name).toBeUndefined();
  });
});

describe('usersRepo.deleteUser', () => {
  it('deletes the user row', async () => {
    await repo.touch('device-1');

    await repo.deleteUser('device-1');

    const found = await db.query.users.findFirst({
      where: (u, { eq }) => eq(u.userId, 'device-1'),
    });
    expect(found).toBeUndefined();
  });
});

describe('usersRepo.updateTopics', () => {
  it('sets the topics list and bumps lastSeenAt, auto-creating the user if absent', async () => {
    const user = await repo.updateTopics('device-1', ['ai', 'dev']);

    expect(user.topics).toEqual(['ai', 'dev']);
  });

  it('replaces the previous topics list wholesale', async () => {
    await repo.updateTopics('device-1', ['ai', 'dev']);

    const user = await repo.updateTopics('device-1', ['space']);

    expect(user.topics).toEqual(['space']);
  });
});

describe('usersRepo.updateLanguage', () => {
  it('sets the language and auto-creates the user if absent', async () => {
    const user = await repo.updateLanguage('device-1', 'pl');

    expect(user.language).toBe('pl');
  });

  it('overwrites an already-set language, unlike touch', async () => {
    await repo.touch('device-1', { deviceLanguage: 'uk' });

    const user = await repo.updateLanguage('device-1', 'pl');

    expect(user.language).toBe('pl');
  });
});

describe('usersRepo.updateMutedSources', () => {
  it('sets the muted sources list (full replace)', async () => {
    await seedSource(db, 'hn');

    const user = await repo.updateMutedSources('device-1', ['hn']);

    expect(user.mutedSources).toEqual(['hn']);
  });

  it('accepts an empty array to unmute everything', async () => {
    await seedSource(db, 'hn');
    await repo.updateMutedSources('device-1', ['hn']);

    const user = await repo.updateMutedSources('device-1', []);

    expect(user.mutedSources).toBeUndefined();
  });
});

describe('usersRepo.addTopicReads', () => {
  it('does nothing when given an empty counts object', async () => {
    await repo.touch('device-1');

    await repo.addTopicReads('device-1', {});

    const user = await repo.touch('device-1');
    expect(user.topicReads).toBeUndefined();
  });

  it('accumulates counts across calls', async () => {
    await repo.touch('device-1');

    await repo.addTopicReads('device-1', { ai: 2, dev: 1 });
    await repo.addTopicReads('device-1', { ai: 3 });

    const user = await repo.touch('device-1');
    expect(user.topicReads).toEqual({ ai: 5, dev: 1 });
  });
});

describe('usersRepo.grantEntitlement', () => {
  it('sets the whole entitlement', async () => {
    await repo.touch('device-1');
    const entitlement = {
      plan: 'plus' as const,
      source: 'manual' as const,
      verifiedAt: '2026-08-12T00:00:00.000Z',
    };

    const user = await repo.grantEntitlement('device-1', entitlement);

    expect(user.entitlement).toEqual(entitlement);
  });

  it('wholesale-replaces a prior entitlement, clearing fields the new one omits', async () => {
    await repo.touch('device-1');
    await repo.grantEntitlement('device-1', {
      plan: 'plus',
      source: 'play',
      productId: 'techtok.plus.monthly',
      expiresAt: '2026-09-01T00:00:00.000Z',
      verifiedAt: '2026-08-01T00:00:00.000Z',
    });

    const user = await repo.grantEntitlement('device-1', {
      plan: 'free',
      source: 'manual',
      verifiedAt: '2026-08-12T00:00:00.000Z',
    });

    expect(user.entitlement).toEqual({
      plan: 'free',
      source: 'manual',
      verifiedAt: '2026-08-12T00:00:00.000Z',
    });
  });
});

describe('usersRepo.incrementQuota', () => {
  it('starts a fresh quota at zero for the other field on first use', async () => {
    await repo.touch('device-1');

    const quota = await repo.incrementQuota('device-1', 'cardReads', 'UTC');

    expect(quota.cardReads).toBe(1);
    expect(quota.readerOpens).toBe(0);
    expect(quota.day).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('increments the field in place on repeated calls the same day', async () => {
    await repo.touch('device-1');
    await repo.incrementQuota('device-1', 'cardReads', 'UTC');

    const quota = await repo.incrementQuota('device-1', 'cardReads', 'UTC', 5);

    expect(quota.cardReads).toBe(6);
  });

  it('increments readerOpens independently of cardReads on the same day', async () => {
    await repo.touch('device-1');
    await repo.incrementQuota('device-1', 'cardReads', 'UTC', 3);

    const quota = await repo.incrementQuota('device-1', 'readerOpens', 'UTC');

    expect(quota).toEqual({ day: quota.day, cardReads: 3, readerOpens: 1 });
  });
});
