import { beforeEach, describe, expect, it } from 'vitest';
import { createTestDb, type TestSqlClient } from '../db/testDb';
import { TestersRepo } from './testersRepo';

let db: TestSqlClient;
let repo: TestersRepo;

beforeEach(async () => {
  db = await createTestDb();
  repo = new TestersRepo(db);
});

describe('testersRepo.exists', () => {
  it('returns false for an email never submitted', async () => {
    expect(await repo.exists('nobody@example.com')).toBe(false);
  });

  it('returns true after the email was created', async () => {
    await repo.create('tester@example.com', '2026-09-26T00:00:00.000Z');

    expect(await repo.exists('tester@example.com')).toBe(true);
  });
});

describe('testersRepo.create', () => {
  it('is idempotent for a repeat submission of the same email', async () => {
    await repo.create('tester@example.com', '2026-09-26T00:00:00.000Z');

    await expect(
      repo.create('tester@example.com', '2026-09-27T00:00:00.000Z'),
    ).resolves.toBeUndefined();
    expect(await repo.exists('tester@example.com')).toBe(true);
  });
});
