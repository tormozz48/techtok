import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import { drizzle, type PgliteDatabase } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { onTestFinished } from 'vitest';
import * as relations from './relations';
import * as schema from './schema';

const MIGRATIONS_FOLDER = fileURLToPath(new URL('../../drizzle', import.meta.url));

export type TestSqlClient = PgliteDatabase<typeof schema & typeof relations>;

let migratedDataDir: Promise<Blob | File> | undefined;

export async function createTestDb(): Promise<TestSqlClient> {
  const client = new PGlite({ loadDataDir: await migratedDataDirOnce() });
  onTestFinished(() => client.close());
  return drizzle(client, { schema: { ...schema, ...relations } });
}

function migratedDataDirOnce(): Promise<Blob | File> {
  migratedDataDir ??= buildMigratedDataDir();
  return migratedDataDir;
}

async function buildMigratedDataDir(): Promise<Blob | File> {
  const client = new PGlite();
  await migrate(drizzle(client), { migrationsFolder: MIGRATIONS_FOLDER });
  const dataDir = await client.dumpDataDir('none');
  await client.close();
  return dataDir;
}
