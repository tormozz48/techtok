import { and, eq, lt, or, type SQL, sql } from 'drizzle-orm';
import type { AnyPgColumn } from 'drizzle-orm/pg-core';

const LIKE_SPECIAL_CHARS = /[\\%_]/g;

export interface Cursor {
  readonly ts: string;
  readonly postId: string;
}

export interface Page<T> {
  readonly rows: T[];
  readonly nextCursor: string | null;
}

export function decodeCursor(raw: string | undefined): Cursor | undefined {
  if (!raw) return undefined;
  try {
    const parsed = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8'));
    if (typeof parsed?.ts === 'string' && typeof parsed?.postId === 'string') {
      return { ts: parsed.ts, postId: parsed.postId };
    }
    return undefined;
  } catch {
    return undefined;
  }
}

export function beforeCursor(
  tsColumn: AnyPgColumn,
  postIdColumn: AnyPgColumn,
  cursor: Cursor | undefined,
): SQL | undefined {
  if (!cursor) return undefined;
  return or(lt(tsColumn, cursor.ts), and(eq(tsColumn, cursor.ts), lt(postIdColumn, cursor.postId)));
}

export function matchesQuery(q: string | undefined, ...columns: AnyPgColumn[]): SQL | undefined {
  if (!q) return undefined;
  const haystack = sql.join(columns, sql` || ' ' || `);
  const pattern = `%${q.replace(LIKE_SPECIAL_CHARS, (char) => `\\${char}`)}%`;
  return sql`(${haystack}) ilike ${pattern}`;
}

export function paginate<T extends Cursor>(rows: T[], limit: number): Page<T> {
  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const last = page.at(-1);
  return {
    rows: page,
    nextCursor: hasMore && last ? encodeCursor({ ts: last.ts, postId: last.postId }) : null,
  };
}

function encodeCursor(cursor: Cursor): string {
  return Buffer.from(JSON.stringify(cursor), 'utf8').toString('base64url');
}
