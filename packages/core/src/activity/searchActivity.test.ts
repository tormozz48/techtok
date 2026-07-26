import { describe, expect, it, vi } from 'vitest';
import { searchActivity } from './searchActivity';

interface Item {
  id: string;
  snapshot: { cardTitle: string; sourceName: string };
}

type FetchPage = (cursor?: string) => Promise<{ items: Item[]; nextCursor: string | null }>;

function item(id: string, cardTitle: string, sourceName = 'Hacker News'): Item {
  return { id, snapshot: { cardTitle, sourceName } };
}

function singlePage(items: Item[]) {
  return vi.fn<FetchPage>().mockResolvedValue({ items, nextCursor: null });
}

describe('searchActivity', () => {
  it('matches on cardTitle, case-insensitively', async () => {
    const fetchPage = singlePage([item('a', 'Rust compiler gets faster'), item('b', 'Bakeries')]);

    const result = await searchActivity(fetchPage, { q: 'RUST', limit: 20 });

    expect(result.items.map((i) => i.id)).toEqual(['a']);
    expect(result.nextCursor).toBeNull();
  });

  it('matches on sourceName as well as cardTitle', async () => {
    const fetchPage = singlePage([
      item('a', 'Unrelated headline', 'The Verge'),
      item('b', 'Another headline', 'TechCrunch'),
    ]);

    const result = await searchActivity(fetchPage, { q: 'verge', limit: 20 });

    expect(result.items.map((i) => i.id)).toEqual(['a']);
  });

  it('returns no matches when nothing fits, without throwing', async () => {
    const fetchPage = singlePage([item('a', 'Bakeries'), item('b', 'Gardening')]);

    const result = await searchActivity(fetchPage, { q: 'rust', limit: 20 });

    expect(result.items).toEqual([]);
  });

  it('pages through fetchPage using the cursor it returns, following nextCursor across calls', async () => {
    const fetchPage = vi
      .fn<FetchPage>()
      .mockResolvedValueOnce({ items: [item('a', 'Bakeries')], nextCursor: 'cursor1' })
      .mockResolvedValueOnce({ items: [item('b', 'Rust news')], nextCursor: null });

    const result = await searchActivity(fetchPage, { q: 'rust', limit: 20 });

    expect(result.items.map((i) => i.id)).toEqual(['b']);
    expect(fetchPage).toHaveBeenCalledTimes(2);
    expect(fetchPage).toHaveBeenNthCalledWith(1, undefined);
    expect(fetchPage).toHaveBeenNthCalledWith(2, 'cursor1');
  });

  it('stops once it has collected `limit` matches, without fetching further pages', async () => {
    const fetchPage = vi
      .fn<FetchPage>()
      .mockResolvedValueOnce({
        items: [item('a', 'Rust one'), item('b', 'Rust two')],
        nextCursor: 'cursor1',
      })
      .mockResolvedValueOnce({ items: [item('c', 'Rust three')], nextCursor: null });

    const result = await searchActivity(fetchPage, { q: 'rust', limit: 2 });

    expect(result.items.map((i) => i.id)).toEqual(['a', 'b']);
    expect(fetchPage).toHaveBeenCalledTimes(1);
  });

  it('stops scanning once maxScanned rows have been examined, even mid-page', async () => {
    const fetchPage = singlePage([
      item('a', 'Bakeries'),
      item('b', 'Gardening'),
      item('c', 'Rust news'), // would match, but falls past the 2-row scan cap
    ]);

    const result = await searchActivity(fetchPage, { q: 'rust', limit: 20, maxScanned: 2 });

    expect(result.items).toEqual([]);
  });

  it('stops when a page comes back empty', async () => {
    const fetchPage = singlePage([]);

    const result = await searchActivity(fetchPage, { q: 'rust', limit: 20 });

    expect(result.items).toEqual([]);
    expect(fetchPage).toHaveBeenCalledTimes(1);
  });

  it('always returns a null nextCursor, even mid-scan', async () => {
    const fetchPage = vi
      .fn<FetchPage>()
      .mockResolvedValueOnce({ items: [item('a', 'Bakeries')], nextCursor: 'cursor1' });

    const result = await searchActivity(fetchPage, { q: 'rust', limit: 20, maxScanned: 1 });

    expect(result.nextCursor).toBeNull();
  });
});
