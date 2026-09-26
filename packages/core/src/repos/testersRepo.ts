import { eq } from 'drizzle-orm';
import type { SqlClient } from '../clients/sqlClient';
import { testers } from '../db/schema';

export interface TesterRecord {
  readonly email: string;
  readonly playAddedAt: string | null;
}

export class TestersRepo {
  constructor(private readonly db: SqlClient) {}

  async findByEmail(email: string): Promise<TesterRecord | undefined> {
    const [row] = await this.db.select().from(testers).where(eq(testers.email, email)).limit(1);
    return row ? { email: row.email, playAddedAt: row.playAddedAt } : undefined;
  }

  async recordAdded(email: string, addedAt: string = new Date().toISOString()): Promise<void> {
    await this.db
      .insert(testers)
      .values({ email, createdAt: addedAt, playAddedAt: addedAt })
      .onConflictDoUpdate({ target: testers.email, set: { playAddedAt: addedAt } });
  }
}
