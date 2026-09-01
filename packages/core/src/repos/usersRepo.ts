import type { Language, Topic } from '@techtok/shared';
import { desc, eq, sql } from 'drizzle-orm';
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
import type { UserRecord } from '../users.types';

type QuotaField = 'cardReads' | 'readerOpens';

export interface TouchOptions {
  readonly deviceLanguage?: Language;
  readonly timezone?: string;
  readonly email?: string;
  readonly name?: string;
}

export class UsersRepo {
  constructor(private readonly db: SqlClient) {}

  async touch(userId: string, opts: TouchOptions = {}): Promise<UserRecord> {
    const now = new Date().toISOString();
    await this.db
      .insert(users)
      .values({
        userId,
        createdAt: now,
        lastSeenAt: now,
        language: opts.deviceLanguage ?? 'en',
        timezone: opts.timezone ?? 'UTC',
        email: opts.email,
        name: opts.name,
      })
      .onConflictDoUpdate({
        target: users.userId,
        set: {
          lastSeenAt: now,
          ...(opts.email !== undefined ? { email: opts.email } : {}),
          ...(opts.name !== undefined ? { name: opts.name } : {}),
        },
      });
    return hydrateUser(this.db, userId);
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
    return hydrateUser(this.db, userId);
  }

  async incrementQuota(
    userId: string,
    field: QuotaField,
    timezone: string,
    by = 1,
  ): Promise<Quota> {
    const today = localDayKey(timezone);
    const [row] = await this.db
      .insert(userQuotas)
      .values({
        userId,
        day: today,
        cardReads: field === 'cardReads' ? by : 0,
        readerOpens: field === 'readerOpens' ? by : 0,
      })
      .onConflictDoUpdate({
        target: [userQuotas.userId, userQuotas.day],
        set:
          field === 'cardReads'
            ? { cardReads: sql`${userQuotas.cardReads} + ${by}` }
            : { readerOpens: sql`${userQuotas.readerOpens} + ${by}` },
      })
      .returning();
    if (!row) throw new Error(`incrementQuota upsert for ${userId} returned no row`);
    return { day: row.day, cardReads: row.cardReads, readerOpens: row.readerOpens };
  }

  async updateTopics(userId: string, topics: Topic[]): Promise<UserRecord> {
    await this.touchLastSeen(userId);
    await this.db.delete(userTopics).where(eq(userTopics.userId, userId));
    if (topics.length > 0) {
      await this.db.insert(userTopics).values(topics.map((topic) => ({ userId, topic })));
    }
    return hydrateUser(this.db, userId);
  }

  async updateLanguage(userId: string, language: Language): Promise<UserRecord> {
    const now = new Date().toISOString();
    await this.db
      .insert(users)
      .values({ userId, createdAt: now, lastSeenAt: now, language })
      .onConflictDoUpdate({ target: users.userId, set: { language, lastSeenAt: now } });
    return hydrateUser(this.db, userId);
  }

  async updateMutedSources(userId: string, mutedSources: string[]): Promise<UserRecord> {
    await this.touchLastSeen(userId);
    await this.db.delete(userMutedSources).where(eq(userMutedSources.userId, userId));
    if (mutedSources.length > 0) {
      await this.db
        .insert(userMutedSources)
        .values(mutedSources.map((sourceId) => ({ userId, sourceId })));
    }
    return hydrateUser(this.db, userId);
  }

  async addTopicReads(userId: string, counts: Partial<Record<Topic, number>>): Promise<void> {
    const entries = Object.entries(counts) as [Topic, number][];
    if (entries.length === 0) return;

    await this.db
      .insert(userTopicReads)
      .values(entries.map(([topic, count]) => ({ userId, topic, readCount: count })))
      .onConflictDoUpdate({
        target: [userTopicReads.userId, userTopicReads.topic],
        set: { readCount: sql`${userTopicReads.readCount} + excluded.read_count` },
      });
  }

  private async touchLastSeen(userId: string): Promise<void> {
    const now = new Date().toISOString();
    await this.db
      .insert(users)
      .values({ userId, createdAt: now, lastSeenAt: now })
      .onConflictDoUpdate({ target: users.userId, set: { lastSeenAt: now } });
  }
}

async function hydrateUser(db: SqlClient, userId: string): Promise<UserRecord> {
  const row = await db.query.users.findFirst({
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

  const topicReadsEntries = row.topicReads.map((r) => [r.topic, r.readCount] as [Topic, number]);
  const latestQuota = row.quotas[0];
  const entitlement = row.entitlement;

  return {
    userId: row.userId,
    topics: row.topics.map((t) => t.topic),
    createdAt: row.createdAt,
    lastSeenAt: row.lastSeenAt,
    language: row.language ?? undefined,
    mutedSources: row.mutedSources.length > 0 ? row.mutedSources.map((m) => m.sourceId) : undefined,
    topicReads: topicReadsEntries.length > 0 ? Object.fromEntries(topicReadsEntries) : undefined,
    email: row.email ?? undefined,
    name: row.name ?? undefined,
    timezone: row.timezone ?? undefined,
    entitlement: entitlement
      ? {
          plan: entitlement.plan,
          source: entitlement.source,
          expiresAt: entitlement.expiresAt ?? undefined,
          productId: entitlement.productId ?? undefined,
          purchaseToken: entitlement.purchaseToken ?? undefined,
          verifiedAt: entitlement.verifiedAt,
        }
      : undefined,
    quota: latestQuota
      ? {
          day: latestQuota.day,
          cardReads: latestQuota.cardReads,
          readerOpens: latestQuota.readerOpens,
        }
      : undefined,
  };
}
