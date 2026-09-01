import { beforeEach, describe, expect, it } from 'vitest';
import { createTestDb, type TestSqlClient } from '../db/testDb';
import type { SourceRecord } from '../sources.types';
import { SourcesRepo } from './sourcesRepo';

let db: TestSqlClient;
let repo: SourcesRepo;

beforeEach(async () => {
  db = await createTestDb();
  repo = new SourcesRepo(db);
});

const sampleSource: SourceRecord = {
  sourceId: 'hn',
  name: 'Hacker News',
  rssUrl: 'https://hnrss.org/frontpage',
  defaultTopic: 'dev',
  weight: 1,
  enabled: true,
  failCount: 0,
};

const disabledSource: SourceRecord = {
  ...sampleSource,
  sourceId: 'disabled-source',
  enabled: false,
};

describe('sourcesRepo.listEnabled', () => {
  it('returns only enabled sources', async () => {
    await repo.putIfNew(sampleSource);
    await repo.putIfNew(disabledSource);

    const items = await repo.listEnabled();

    expect(items).toEqual([sampleSource]);
  });
});

describe('sourcesRepo.getById', () => {
  it('returns the item when found', async () => {
    await repo.putIfNew(sampleSource);

    expect(await repo.getById('hn')).toEqual(sampleSource);
  });

  it('returns undefined when not found', async () => {
    expect(await repo.getById('missing')).toBeUndefined();
  });
});

describe('sourcesRepo.putIfNew', () => {
  it('inserts a new source and returns true', async () => {
    expect(await repo.putIfNew(sampleSource)).toBe(true);
    expect(await repo.getById('hn')).toEqual(sampleSource);
  });

  it('returns false without throwing when the source already exists', async () => {
    await repo.putIfNew(sampleSource);

    await expect(repo.putIfNew({ ...sampleSource, name: 'Renamed' })).resolves.toBe(false);
    expect(await repo.getById('hn')).toMatchObject({ name: 'Hacker News' });
  });
});

describe('sourcesRepo.recordFetchResult', () => {
  beforeEach(async () => {
    await repo.putIfNew(sampleSource);
  });

  it('resets failCount and stores etag/lastModified on success', async () => {
    await repo.recordFetchResult('hn', {
      status: 'ok',
      etag: 'W/"abc"',
      lastModified: 'Sat, 18 Jul 2026 00:00:00 GMT',
    });

    const source = await repo.getById('hn');
    expect(source).toMatchObject({
      lastStatus: 'ok',
      failCount: 0,
      etag: 'W/"abc"',
      lastModified: 'Sat, 18 Jul 2026 00:00:00 GMT',
    });
  });

  it('stores newestSeenPublishedAt when provided', async () => {
    await repo.recordFetchResult('hn', {
      status: 'ok',
      newestSeenPublishedAt: '2026-07-18T17:53:05.000Z',
    });

    expect(await repo.getById('hn')).toMatchObject({
      newestSeenPublishedAt: '2026-07-18T17:53:05.000Z',
    });
  });

  it('records not-modified without requiring etag/lastModified', async () => {
    await repo.recordFetchResult('hn', { status: 'not-modified' });

    const source = await repo.getById('hn');
    expect(source?.lastStatus).toBe('not-modified');
    expect(source?.etag).toBeUndefined();
  });

  it('increments failCount on error and leaves etag/lastModified untouched', async () => {
    await repo.recordFetchResult('hn', {
      status: 'ok',
      etag: 'W/"abc"',
      lastModified: 'Sat, 18 Jul 2026 00:00:00 GMT',
    });

    await repo.recordFetchResult('hn', { status: 'error' });

    const source = await repo.getById('hn');
    expect(source).toMatchObject({
      lastStatus: 'error',
      failCount: 1,
      etag: 'W/"abc"',
      lastModified: 'Sat, 18 Jul 2026 00:00:00 GMT',
    });
  });

  it('increments failCount again on a second consecutive error', async () => {
    await repo.recordFetchResult('hn', { status: 'error' });
    await repo.recordFetchResult('hn', { status: 'error' });

    expect(await repo.getById('hn')).toMatchObject({ failCount: 2 });
  });
});
