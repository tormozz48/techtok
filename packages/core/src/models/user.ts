import type { Topic } from '@techtok/shared';
import type {
  topics,
  userEntitlements,
  userMutedSources,
  userQuotas,
  users,
  userTopicReads,
  userTopics,
} from '../db/schema';
import type { Entitlement, Quota } from '../entitlement/entitlement.types';
import type { UserRecord } from '../users.types';
import { emptyToUndefined } from '../util/emptyToUndefined';

type UserRow = typeof users.$inferSelect;

type TopicRow = typeof topics.$inferSelect;

export type QuotaRow = typeof userQuotas.$inferSelect;

export type UserAggregateRow = UserRow & {
  topics: (typeof userTopics.$inferSelect & { topic: TopicRow })[];
  mutedSources: (typeof userMutedSources.$inferSelect)[];
  topicReads: (typeof userTopicReads.$inferSelect & { topic: TopicRow })[];
  quotas: QuotaRow[];
  entitlement: typeof userEntitlements.$inferSelect | null;
};

export class User {
  constructor(private readonly row: UserAggregateRow) {}

  static toQuota(row: QuotaRow): Quota {
    return { day: row.day, cardReads: row.cardReads, readerOpens: row.readerOpens };
  }

  toRecord(): UserRecord {
    const { row } = this;
    return {
      userId: row.externalId,
      topics: row.topics.map((link) => link.topic.slug),
      createdAt: row.createdAt,
      lastSeenAt: row.lastSeenAt,
      language: row.language ?? undefined,
      mutedSources: emptyToUndefined(row.mutedSources.map((muted) => muted.sourceSlug)),
      topicReads: this.topicReads,
      email: row.email ?? undefined,
      name: row.name ?? undefined,
      timezone: row.timezone ?? undefined,
      entitlement: this.entitlement,
      quota: this.latestQuota,
    };
  }

  private get topicReads(): Partial<Record<Topic, number>> | undefined {
    const { topicReads } = this.row;
    if (topicReads.length === 0) return undefined;
    return Object.fromEntries(topicReads.map((read) => [read.topic.slug, read.readCount]));
  }

  private get entitlement(): Entitlement | undefined {
    const { entitlement } = this.row;
    if (!entitlement) return undefined;
    return {
      plan: entitlement.plan,
      source: entitlement.source,
      expiresAt: entitlement.expiresAt ?? undefined,
      productId: entitlement.productId ?? undefined,
      purchaseToken: entitlement.purchaseToken ?? undefined,
      verifiedAt: entitlement.verifiedAt,
    };
  }

  private get latestQuota(): Quota | undefined {
    const [latest] = this.row.quotas;
    return latest ? User.toQuota(latest) : undefined;
  }
}
