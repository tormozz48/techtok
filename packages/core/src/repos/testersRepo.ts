import { eq } from 'drizzle-orm';
import type { SqlClient } from '../clients/sqlClient';
import { testers } from '../db/schema';

export class TestersRepo {
  constructor(private readonly db: SqlClient) {}

  async exists(email: string): Promise<boolean> {
    const [row] = await this.db
      .select({ id: testers.id })
      .from(testers)
      .where(eq(testers.email, email))
      .limit(1);
    return row !== undefined;
  }

  async create(email: string, createdAt: string = new Date().toISOString()): Promise<void> {
    await this.db.insert(testers).values({ email, createdAt }).onConflictDoNothing();
  }
}
