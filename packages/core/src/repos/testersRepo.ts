import type { SqlClient } from '../clients/sqlClient';
import { testers } from '../db/schema';

export class TestersRepo {
  constructor(private readonly db: SqlClient) {}

  async create(email: string, createdAt: string = new Date().toISOString()): Promise<void> {
    await this.db.insert(testers).values({ email, createdAt }).onConflictDoNothing();
  }
}
