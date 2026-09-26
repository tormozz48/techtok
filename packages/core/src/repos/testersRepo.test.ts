import { sql } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import { createTestDb, type TestSqlClient } from '../db/testDb';
import { TestersRepo } from './testersRepo';

let db: TestSqlClient;
let repo: TestersRepo;

async function storedEmails(): Promise<unknown[]> {
  const result = await db.execute(sql`select email from testers order by email`);
  return result.rows.map((row) => row.email);
}

beforeEach(async () => {
  db = await createTestDb();
  repo = new TestersRepo(db);
});

describe('testersRepo.create', () => {
  it('stores a submitted email', async () => {
    await repo.create('tester@example.com', '2026-09-26T00:00:00.000Z');

    expect(await storedEmails()).toEqual(['tester@example.com']);
  });

  it('keeps a single row for a repeat submission of the same email', async () => {
    await repo.create('tester@example.com', '2026-09-26T00:00:00.000Z');
    await repo.create('tester@example.com', '2026-09-27T00:00:00.000Z');

    expect(await storedEmails()).toEqual(['tester@example.com']);
  });
});
