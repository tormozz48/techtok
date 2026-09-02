import type { Topic } from '@techtok/shared';
import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import type { AnyPgColumn } from 'drizzle-orm/pg-core';
import type { SqlClient } from '../clients/sqlClient';
import { beforeCursor, decodeCursor, matchesQuery, type Page, paginate } from '../db/cursor';
import { decodeId, decodeIds, encodeId } from '../db/ids';
import { topics, userBookmarks, userReads, users } from '../db/schema';
import type { ActivityRecord, BookmarkRecord, ReadSnapshot } from '../history.types';
import { Activity, type ActivitySelection } from '../models/activity';

type ActivityTable = typeof userReads | typeof userBookmarks;

const DEFAULT_LIMIT = 50;

const WAS_NEW = sql<boolean>`xmax = 0`;

export interface ActivityQueryOpts {
  readonly limit?: number;
  readonly cursor?: string;
  readonly q?: string;
}

export interface HistoryPage {
  readonly items: ActivityRecord[];
  readonly nextCursor: string | null;
}

export interface BookmarksPage {
  readonly items: BookmarkRecord[];
  readonly nextCursor: string | null;
}

export class UserActivityRepo {
  constructor(private readonly db: SqlClient) {}

  async markRead(
    userId: string,
    postId: string,
    snapshot: ReadSnapshot,
    readAt: string = new Date().toISOString(),
  ): Promise<{ wasNew: boolean }> {
    const id = decodeId(postId);
    if (id === undefined) return { wasNew: false };
    const row = { userId: userIdOf(userId), postId: id, readAt, ...toColumns(snapshot) };
    const [inserted] = await this.db
      .insert(userReads)
      .values(row)
      .onConflictDoUpdate({ target: [userReads.userId, userReads.postId], set: row })
      .returning({ wasNew: WAS_NEW });
    return { wasNew: inserted?.wasNew ?? false };
  }

  async getReadSet(userId: string, postIds: string[]): Promise<Set<string>> {
    return this.selectPostIds(userReads, userId, postIds);
  }

  async queryHistory(userId: string, opts: ActivityQueryOpts = {}): Promise<HistoryPage> {
    const { rows, nextCursor } = await this.queryActivity(
      userReads,
      userReads.readAt,
      userId,
      opts,
    );
    return { items: rows.map((row) => new Activity(userId, row).toReadRecord()), nextCursor };
  }

  async addBookmark(
    userId: string,
    postId: string,
    snapshot: ReadSnapshot,
    bookmarkedAt: string = new Date().toISOString(),
  ): Promise<void> {
    const id = decodeId(postId);
    if (id === undefined) return;
    const row = { userId: userIdOf(userId), postId: id, bookmarkedAt, ...toColumns(snapshot) };
    await this.db
      .insert(userBookmarks)
      .values(row)
      .onConflictDoUpdate({ target: [userBookmarks.userId, userBookmarks.postId], set: row });
  }

  async removeBookmark(userId: string, postId: string): Promise<void> {
    const id = decodeId(postId);
    if (id === undefined) return;
    await this.db
      .delete(userBookmarks)
      .where(and(eq(userBookmarks.userId, userIdOf(userId)), eq(userBookmarks.postId, id)));
  }

  async getBookmarkSet(userId: string, postIds: string[]): Promise<Set<string>> {
    return this.selectPostIds(userBookmarks, userId, postIds);
  }

  async queryBookmarks(userId: string, opts: ActivityQueryOpts = {}): Promise<BookmarksPage> {
    const { rows, nextCursor } = await this.queryActivity(
      userBookmarks,
      userBookmarks.bookmarkedAt,
      userId,
      opts,
    );
    return { items: rows.map((row) => new Activity(userId, row).toBookmarkRecord()), nextCursor };
  }

  async deleteAllForUser(userId: string): Promise<void> {
    await this.db.delete(userReads).where(eq(userReads.userId, userIdOf(userId)));
    await this.db.delete(userBookmarks).where(eq(userBookmarks.userId, userIdOf(userId)));
  }

  private async selectPostIds(
    table: ActivityTable,
    userId: string,
    postIds: string[],
  ): Promise<Set<string>> {
    const ids = decodeIds(postIds);
    if (ids.length === 0) return new Set();
    const rows = await this.db
      .select({ postId: table.postId })
      .from(table)
      .where(and(eq(table.userId, userIdOf(userId)), inArray(table.postId, ids)));
    return new Set(rows.map((row) => encodeId(row.postId)));
  }

  private async queryActivity(
    table: ActivityTable,
    tsColumn: AnyPgColumn,
    userId: string,
    opts: ActivityQueryOpts,
  ): Promise<Page<ActivitySelection>> {
    const limit = opts.limit ?? DEFAULT_LIMIT;
    const rows = await this.db
      .select({
        postId: table.postId,
        ts: tsColumn,
        cardTitle: table.cardTitle,
        sourceName: table.sourceName,
        url: table.url,
        primaryTopic: topics.slug,
      })
      .from(table)
      .leftJoin(topics, eq(table.primaryTopicId, topics.id))
      .where(
        and(
          eq(table.userId, userIdOf(userId)),
          beforeCursor(tsColumn, table.postId, decodeCursor(opts.cursor)),
          matchesQuery(opts.q, table.cardTitle, table.sourceName),
        ),
      )
      .orderBy(desc(tsColumn), desc(table.postId))
      .limit(limit + 1);
    return paginate(rows, limit);
  }
}

function userIdOf(externalId: string) {
  return sql<number>`(select id from ${users} where ${users.externalId} = ${externalId})`;
}

function toColumns(snapshot: ReadSnapshot) {
  return {
    cardTitle: snapshot.cardTitle,
    sourceName: snapshot.sourceName,
    url: snapshot.url,
    primaryTopicId: topicIdOf(snapshot.primaryTopic),
  };
}

function topicIdOf(topic: Topic | undefined) {
  if (!topic) return null;
  return sql<number>`(select id from ${topics} where ${topics.slug} = ${topic})`;
}
