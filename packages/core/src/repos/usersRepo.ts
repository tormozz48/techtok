import type { Language, Topic } from '@techtok/shared';
import { format, subDays } from 'date-fns';
import { desc, eq, lt, sql } from 'drizzle-orm';
import type { SqlClient } from '../clients/sqlClient';
import {
  userEntitlements,
  userMutedSources,
  userQuotas,
  users,
  userTopicReads,
  userTopics,
} from '../db/schema';
import type { Entitlement, Quota } from '../entitlement/entitlement.types';
import { localDayKey } from '../entitlement/quota';
import { User } from '../models/user';
import type { UserRecord } from '../users.types';

type QuotaField = 'cardReads' | 'readerOpens';

const PRUNE_QUOTAS_OLDER_THAN_DAYS = 35;

const DEFAULT_LANGUAGE: Language = 'en';

const DEFAULT_TIMEZONE = 'UTC';

export interface TouchOptions {
  readonly deviceLanguage?: Language;
  readonly timezone?: string;
  readonly email?: string;
  readonly name?: string;
}

export class UsersRepo {
  constructor(private readonly db: SqlClient) {}

  async touch(userId: string, opts: TouchOptions = {}): Promise<UserRecord> {
    await this.upsertUser(
      {
        userId,
        language: opts.deviceLanguage ?? DEFAULT_LANGUAGE,
        timezone: opts.timezone ?? DEFAULT_TIMEZONE,
        email: opts.email,
        name: opts.name,
      },
      {
        ...(opts.email !== undefined ? { email: opts.email } : {}),
        ...(opts.name !== undefined ? { name: opts.name } : {}),
      },
    );
    return this.hydrate(userId);
  }

  async deleteUser(userId: string): Promise<void> {
    await this.db.delete(users).where(eq(users.userId, userId));
  }

  async grantEntitlement(userId: string, entitlement: Entitlement): Promise<UserRecord> {
    const row = {
      userId,
      plan: entitlement.plan,
      source: entitlement.source,
      expiresAt: entitlement.expiresAt ?? null,
      productId: entitlement.productId ?? null,
      purchaseToken: entitlement.purchaseToken ?? null,
      verifiedAt: entitlement.verifiedAt,
    };
    await this.db
      .insert(userEntitlements)
      .values(row)
      .onConflictDoUpdate({ target: userEntitlements.userId, set: row });
    return this.hydrate(userId);
  }

  async incrementQuota(
    userId: string,
    field: QuotaField,
    timezone: string,
    by = 1,
  ): Promise<Quota> {
    const [row] = await this.db
      .insert(userQuotas)
      .values({
        userId,
        day: localDayKey(timezone),
        cardReads: field === 'cardReads' ? by : 0,
        readerOpens: field === 'readerOpens' ? by : 0,
      })
      .onConflictDoUpdate({
        target: [userQuotas.userId, userQuotas.day],
        set: { [field]: sql`${userQuotas[field]} + ${by}` },
      })
      .returning();
    if (!row) throw new Error(`incrementQuota upsert for ${userId} returned no row`);
    return User.toQuota(row);
  }

  async updateTopics(userId: string, topics: Topic[]): Promise<UserRecord> {
    await this.upsertUser({ userId });
    await this.db.delete(userTopics).where(eq(userTopics.userId, userId));
    if (topics.length > 0) {
      await this.db.insert(userTopics).values(topics.map((topic) => ({ userId, topic })));
    }
    return this.hydrate(userId);
  }

  async updateLanguage(userId: string, language: Language): Promise<UserRecord> {
    await this.upsertUser({ userId, language }, { language });
    return this.hydrate(userId);
  }

  async updateMutedSources(userId: string, mutedSources: string[]): Promise<UserRecord> {
    await this.upsertUser({ userId });
    await this.db.delete(userMutedSources).where(eq(userMutedSources.userId, userId));
    if (mutedSources.length > 0) {
      await this.db
        .insert(userMutedSources)
        .values(mutedSources.map((sourceId) => ({ userId, sourceId })));
    }
    return this.hydrate(userId);
  }

  async addTopicReads(userId: string, counts: Partial<Record<Topic, number>>): Promise<void> {
    const entries = Object.entries(counts) as [Topic, number][];
    if (entries.length === 0) return;

    await this.db
      .insert(userTopicReads)
      .values(entries.map(([topic, readCount]) => ({ userId, topic, readCount })))
      .onConflictDoUpdate({
        target: [userTopicReads.userId, userTopicReads.topic],
        set: { readCount: sql`${userTopicReads.readCount} + excluded.read_count` },
      });
  }

  async pruneOldQuotas(now: Date = new Date()): Promise<number> {
    const cutoff = format(subDays(now, PRUNE_QUOTAS_OLDER_THAN_DAYS), 'yyyy-MM-dd');
    const result = await this.db.delete(userQuotas).where(lt(userQuotas.day, cutoff));
    return result.rowCount ?? 0;
  }

  private async upsertUser(
    seed: { userId: string; language?: Language; timezone?: string; email?: string; name?: string },
    patch: Partial<typeof users.$inferInsert> = {},
  ): Promise<void> {
    const now = new Date().toISOString();
    await this.db
      .insert(users)
      .values({ ...seed, createdAt: now, lastSeenAt: now })
      .onConflictDoUpdate({ target: users.userId, set: { ...patch, lastSeenAt: now } });
  }

  private async hydrate(userId: string): Promise<UserRecord> {
    const row = await this.db.query.users.findFirst({
      where: eq(users.userId, userId),
      with: {
        topics: true,
        mutedSources: true,
        topicReads: true,
        quotas: { orderBy: [desc(userQuotas.day)], limit: 1 },
        entitlement: true,
      },
    });
    if (!row) throw new Error(`user ${userId} not found after upsert`);
    return new User(row).toRecord();
  }
}
