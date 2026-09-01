import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import { drizzle, type PgliteDatabase } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import * as relations from './relations';
import * as schema from './schema';

const MIGRATIONS_FOLDER = fileURLToPath(new URL('../../drizzle', import.meta.url));

export type TestSqlClient = PgliteDatabase<typeof schema & typeof relations>;

export async function createTestDb(): Promise<TestSqlClient> {
  const client = new PGlite();
  const db = drizzle(client, { schema: { ...schema, ...relations } });
  await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
  return db;
}
