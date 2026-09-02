import type { Language, Topic } from '@techtok/shared';
import { format, subDays } from 'date-fns';
import { desc, eq, lt, sql } from 'drizzle-orm';
import type { SqlClient } from '../clients/sqlClient';
import { userEntitlements, userMutedSources, userQuotas, users, userTopics } from '../db/schema';
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
        externalId: userId,
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
    await this.db.delete(users).where(eq(users.externalId, userId));
  }

  async grantEntitlement(userId: string, entitlement: Entitlement): Promise<UserRecord> {
    const patch = {
      plan: entitlement.plan,
      source: entitlement.source,
      expiresAt: entitlement.expiresAt ?? null,
      productId: entitlement.productId ?? null,
      purchaseToken: entitlement.purchaseToken ?? null,
      verifiedAt: entitlement.verifiedAt,
    };
    await this.db
      .insert(userEntitlements)
      .values({ userId: userIdOf(userId), ...patch })
      .onConflictDoUpdate({ target: userEntitlements.userId, set: patch });
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
        userId: userIdOf(userId),
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

  async updateTopics(userId: string, topicSlugs: Topic[]): Promise<UserRecord> {
    const id = await this.upsertUser({ externalId: userId });
    await this.db.delete(userTopics).where(eq(userTopics.userId, id));
    if (topicSlugs.length > 0) {
      await this.db.execute(sql`
        insert into user_topics (user_id, topic_id)
        select ${id}, t.id from topics t where t.slug in (${slugList(topicSlugs)})
      `);
    }
    return this.hydrate(userId);
  }

  async updateLanguage(userId: string, language: Language): Promise<UserRecord> {
    await this.upsertUser({ externalId: userId, language }, { language });
    return this.hydrate(userId);
  }

  async updateMutedSources(userId: string, mutedSources: string[]): Promise<UserRecord> {
    const id = await this.upsertUser({ externalId: userId });
    await this.db.delete(userMutedSources).where(eq(userMutedSources.userId, id));
    if (mutedSources.length > 0) {
      await this.db
        .insert(userMutedSources)
        .values(mutedSources.map((sourceSlug) => ({ userId: id, sourceSlug })));
    }
    return this.hydrate(userId);
  }

  async addTopicReads(userId: string, counts: Partial<Record<Topic, number>>): Promise<void> {
    const entries = Object.entries(counts) as [Topic, number][];
    if (entries.length === 0) return;

    const values = sql.join(
      entries.map(([topic, readCount]) => sql`(${topic}::text, ${readCount}::int)`),
      sql`, `,
    );
    await this.db.execute(sql`
      insert into user_topic_reads (user_id, topic_id, read_count)
      select u.id, t.id, v.read_count
      from users u, topics t, (values ${values}) as v(slug, read_count)
      where u.external_id = ${userId} and t.slug = v.slug
      on conflict (user_id, topic_id)
      do update set read_count = user_topic_reads.read_count + excluded.read_count
    `);
  }

  async pruneOldQuotas(now: Date = new Date()): Promise<number> {
    const cutoff = format(subDays(now, PRUNE_QUOTAS_OLDER_THAN_DAYS), 'yyyy-MM-dd');
    const result = await this.db.delete(userQuotas).where(lt(userQuotas.day, cutoff));
    return result.rowCount ?? 0;
  }

  private async upsertUser(
    seed: {
      externalId: string;
      language?: Language;
      timezone?: string;
      email?: string;
      name?: string;
    },
    patch: Partial<typeof users.$inferInsert> = {},
  ): Promise<number> {
    const now = new Date().toISOString();
    const [row] = await this.db
      .insert(users)
      .values({ ...seed, createdAt: now, lastSeenAt: now })
      .onConflictDoUpdate({ target: users.externalId, set: { ...patch, lastSeenAt: now } })
      .returning({ id: users.id });
    if (!row) throw new Error(`upsert for user ${seed.externalId} returned no row`);
    return row.id;
  }

  private async hydrate(userId: string): Promise<UserRecord> {
    const row = await this.db.query.users.findFirst({
      where: eq(users.externalId, userId),
      with: {
        topics: { with: { topic: true } },
        mutedSources: true,
        topicReads: { with: { topic: true } },
        quotas: { orderBy: [desc(userQuotas.day)], limit: 1 },
        entitlement: true,
      },
    });
    if (!row) throw new Error(`user ${userId} not found after upsert`);
    return new User(row).toRecord();
  }
}

function userIdOf(externalId: string) {
  return sql<number>`(select id from ${users} where ${users.externalId} = ${externalId})`;
}

function slugList(list: Topic[]) {
  return sql.join(
    list.map((topic) => sql`${topic}`),
    sql`, `,
  );
}
