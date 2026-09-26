import { beforeEach, describe, expect, it } from 'vitest';
import { createTestDb, type TestSqlClient } from '../db/testDb';
import { TestersRepo } from './testersRepo';

let db: TestSqlClient;
let repo: TestersRepo;

beforeEach(async () => {
  db = await createTestDb();
  repo = new TestersRepo(db);
});

describe('testersRepo.findByEmail', () => {
  it('returns undefined for an email never submitted', async () => {
    expect(await repo.findByEmail('nobody@example.com')).toBeUndefined();
  });

  it('returns the record after it was recorded as added', async () => {
    await repo.recordAdded('tester@example.com', '2026-09-26T00:00:00.000Z');

    expect(await repo.findByEmail('tester@example.com')).toEqual({
      email: 'tester@example.com',
      playAddedAt: '2026-09-26T00:00:00.000Z',
    });
  });
});

describe('testersRepo.recordAdded', () => {
  it('is idempotent for a repeat submission of the same email', async () => {
    await repo.recordAdded('tester@example.com', '2026-09-26T00:00:00.000Z');
    await repo.recordAdded('tester@example.com', '2026-09-27T00:00:00.000Z');

    expect(await repo.findByEmail('tester@example.com')).toEqual({
      email: 'tester@example.com',
      playAddedAt: '2026-09-27T00:00:00.000Z',
    });
  });
});
