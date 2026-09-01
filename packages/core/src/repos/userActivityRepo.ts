import { and, desc, eq, inArray, lt, or, sql } from 'drizzle-orm';
import type { AnyPgColumn } from 'drizzle-orm/pg-core';
import type { SqlClient } from '../clients/sqlClient';
import { userBookmarks, userReads } from '../db/schema';
import type { ActivityRecord, BookmarkRecord, ReadSnapshot } from '../history.types';

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

interface Cursor {
  readonly ts: string;
  readonly postId: string;
}

export class UserActivityRepo {
  constructor(private readonly db: SqlClient) {}

  async markRead(
    userId: string,
    postId: string,
    snapshot: ReadSnapshot,
    readAt: string = new Date().toISOString(),
  ): Promise<{ wasNew: boolean }> {
    const [row] = await this.db
      .insert(userReads)
      .values({
        userId,
        postId,
        readAt,
        cardTitle: snapshot.cardTitle,
        sourceName: snapshot.sourceName,
        url: snapshot.url,
        primaryTopic: snapshot.primaryTopic,
      })
      .onConflictDoUpdate({
        target: [userReads.userId, userReads.postId],
        set: {
          readAt,
          cardTitle: snapshot.cardTitle,
          sourceName: snapshot.sourceName,
          url: snapshot.url,
          primaryTopic: snapshot.primaryTopic ?? null,
        },
      })
      .returning({ wasNew: sql<boolean>`xmax = 0` });
    return { wasNew: row?.wasNew ?? false };
  }

  async getReadSet(userId: string, postIds: string[]): Promise<Set<string>> {
    if (postIds.length === 0) return new Set();
    const rows = await this.db
      .select({ postId: userReads.postId })
      .from(userReads)
      .where(and(eq(userReads.userId, userId), inArray(userReads.postId, postIds)));
    return new Set(rows.map((r) => r.postId));
  }

  async queryHistory(userId: string, opts: ActivityQueryOpts = {}): Promise<HistoryPage> {
    const limit = opts.limit ?? 50;
    const cursor = opts.cursor ? decodeCursor(opts.cursor) : undefined;
    const rows = await this.db
      .select()
      .from(userReads)
      .where(
        and(
          eq(userReads.userId, userId),
          cursor ? beforeCursor(userReads.readAt, userReads.postId, cursor) : undefined,
          opts.q ? matchesQuery(userReads.cardTitle, userReads.sourceName, opts.q) : undefined,
        ),
      )
      .orderBy(desc(userReads.readAt), desc(userReads.postId))
      .limit(limit + 1);

    const { page, nextCursor } = paginate(rows, limit, (row) => ({
      ts: row.readAt,
      postId: row.postId,
    }));
    return {
      items: page.map((row) => ({
        userId: row.userId,
        postId: row.postId,
        readAt: row.readAt,
        snapshot: toSnapshot(row),
      })),
      nextCursor,
    };
  }

  async addBookmark(
    userId: string,
    postId: string,
    snapshot: ReadSnapshot,
    bookmarkedAt: string = new Date().toISOString(),
  ): Promise<void> {
    await this.db
      .insert(userBookmarks)
      .values({
        userId,
        postId,
        bookmarkedAt,
        cardTitle: snapshot.cardTitle,
        sourceName: snapshot.sourceName,
        url: snapshot.url,
        primaryTopic: snapshot.primaryTopic,
      })
      .onConflictDoUpdate({
        target: [userBookmarks.userId, userBookmarks.postId],
        set: {
          bookmarkedAt,
          cardTitle: snapshot.cardTitle,
          sourceName: snapshot.sourceName,
          url: snapshot.url,
          primaryTopic: snapshot.primaryTopic ?? null,
        },
      });
  }

  async removeBookmark(userId: string, postId: string): Promise<void> {
    await this.db
      .delete(userBookmarks)
      .where(and(eq(userBookmarks.userId, userId), eq(userBookmarks.postId, postId)));
  }

  async getBookmarkSet(userId: string, postIds: string[]): Promise<Set<string>> {
    if (postIds.length === 0) return new Set();
    const rows = await this.db
      .select({ postId: userBookmarks.postId })
      .from(userBookmarks)
      .where(and(eq(userBookmarks.userId, userId), inArray(userBookmarks.postId, postIds)));
    return new Set(rows.map((r) => r.postId));
  }

  async queryBookmarks(userId: string, opts: ActivityQueryOpts = {}): Promise<BookmarksPage> {
    const limit = opts.limit ?? 50;
    const cursor = opts.cursor ? decodeCursor(opts.cursor) : undefined;
    const rows = await this.db
      .select()
      .from(userBookmarks)
      .where(
        and(
          eq(userBookmarks.userId, userId),
          cursor
            ? beforeCursor(userBookmarks.bookmarkedAt, userBookmarks.postId, cursor)
            : undefined,
          opts.q
            ? matchesQuery(userBookmarks.cardTitle, userBookmarks.sourceName, opts.q)
            : undefined,
        ),
      )
      .orderBy(desc(userBookmarks.bookmarkedAt), desc(userBookmarks.postId))
      .limit(limit + 1);

    const { page, nextCursor } = paginate(rows, limit, (row) => ({
      ts: row.bookmarkedAt,
      postId: row.postId,
    }));
    return {
      items: page.map((row) => ({
        userId: row.userId,
        postId: row.postId,
        bookmarkedAt: row.bookmarkedAt,
        snapshot: toSnapshot(row),
      })),
      nextCursor,
    };
  }

  async deleteAllForUser(userId: string): Promise<void> {
    await this.db.delete(userReads).where(eq(userReads.userId, userId));
    await this.db.delete(userBookmarks).where(eq(userBookmarks.userId, userId));
  }
}

function toSnapshot(row: {
  cardTitle: string;
  sourceName: string;
  url: string;
  primaryTopic: ReadSnapshot['primaryTopic'] | null;
}): ReadSnapshot {
  return {
    cardTitle: row.cardTitle,
    sourceName: row.sourceName,
    url: row.url,
    primaryTopic: row.primaryTopic ?? undefined,
  };
}

function paginate<T, K extends { ts: string; postId: string }>(
  rows: T[],
  limit: number,
  cursorOf: (row: T) => K,
): { page: T[]; nextCursor: string | null } {
  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const last = page.at(-1);
  return { page, nextCursor: hasMore && last ? encodeCursor(cursorOf(last)) : null };
}

function beforeCursor(tsColumn: AnyPgColumn, postIdColumn: AnyPgColumn, cursor: Cursor) {
  return or(lt(tsColumn, cursor.ts), and(eq(tsColumn, cursor.ts), lt(postIdColumn, cursor.postId)));
}

function matchesQuery(cardTitleColumn: AnyPgColumn, sourceNameColumn: AnyPgColumn, q: string) {
  return sql`(${cardTitleColumn} || ' ' || ${sourceNameColumn}) ilike ${`%${escapeLikePattern(q)}%`}`;
}

function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}

function encodeCursor(cursor: Cursor): string {
  return Buffer.from(JSON.stringify(cursor), 'utf8').toString('base64url');
}

function decodeCursor(cursor: string): Cursor | undefined {
  try {
    const parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
    if (typeof parsed?.ts === 'string' && typeof parsed?.postId === 'string') return parsed;
    return undefined;
  } catch {
    return undefined;
  }
}
