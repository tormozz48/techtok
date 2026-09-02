import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import type { PgDatabase } from 'drizzle-orm/pg-core';
import * as relations from '../db/relations';
import * as schema from '../db/schema';

type FullSchema = typeof schema & typeof relations;

export type SqlClient = PgDatabase<any, FullSchema>;

export function createSqlClient(databaseUrl: string): SqlClient {
  return drizzle(neon(databaseUrl), { schema: { ...schema, ...relations } });
}
