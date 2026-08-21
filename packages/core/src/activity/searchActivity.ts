export interface SearchableActivityItem {
  readonly snapshot: {
    readonly cardTitle: string;
    readonly sourceName: string;
  };
}

export interface SearchActivityPage<T> {
  readonly items: T[];
  readonly nextCursor: string | null;
}

export interface SearchActivityOpts {
  readonly q: string;
  readonly limit: number;
  readonly maxScanned?: number;
}

const DEFAULT_MAX_SCANNED = 500;

export const SEARCH_FETCH_PAGE_SIZE = 100;

export async function searchActivity<T extends SearchableActivityItem>(
  fetchPage: (cursor?: string) => Promise<{ items: T[]; nextCursor: string | null }>,
  opts: SearchActivityOpts,
): Promise<SearchActivityPage<T>> {
  const maxScanned = opts.maxScanned ?? DEFAULT_MAX_SCANNED;
  const needle = opts.q.toLocaleLowerCase();

  const matches: T[] = [];
  let scanned = 0;
  let cursor: string | undefined;

  while (matches.length < opts.limit && scanned < maxScanned) {
    const page = await fetchPage(cursor);
    if (page.items.length === 0) break;

    for (const item of page.items) {
      scanned += 1;
      const haystack = `${item.snapshot.cardTitle} ${item.snapshot.sourceName}`.toLocaleLowerCase();
      if (haystack.includes(needle)) {
        matches.push(item);
        if (matches.length >= opts.limit) break;
      }
      if (scanned >= maxScanned) break;
    }

    if (!page.nextCursor) break;
    cursor = page.nextCursor;
  }

  return { items: matches, nextCursor: null };
}
