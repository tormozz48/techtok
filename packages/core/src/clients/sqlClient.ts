import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as relations from '../db/relations';
import * as schema from '../db/schema';

export type SqlClient = ReturnType<typeof createSqlClient>;

export function createSqlClient(databaseUrl: string) {
  return drizzle(neon(databaseUrl), { schema: { ...schema, ...relations } });
}
