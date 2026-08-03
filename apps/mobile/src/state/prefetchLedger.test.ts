import { forgetPrefetch, PREFETCH_LEDGER_CAP, recordPrefetch } from './prefetchLedger';
import { storage } from './storage';

describe('prefetchLedger', () => {
  beforeEach(() => {
    storage.clearAll();
  });

  it('returns no evictions while under the cap', () => {
    expect(recordPrefetch('a', 'en')).toEqual([]);
    expect(recordPrefetch('b', 'en')).toEqual([]);
  });

  it('evicts the oldest entry once the cap is exceeded', () => {
    for (let i = 0; i < PREFETCH_LEDGER_CAP; i++) {
      expect(recordPrefetch(`post-${i}`, 'en')).toEqual([]);
    }

    expect(recordPrefetch('post-overflow', 'en')).toEqual([{ postId: 'post-0', language: 'en' }]);
  });

  it('re-touching an existing entry refreshes its recency instead of duplicating it', () => {
    for (let i = 0; i < PREFETCH_LEDGER_CAP; i++) {
      recordPrefetch(`post-${i}`, 'en');
    }
    // post-0 is the oldest; touching it again should make post-1 the oldest instead.
    expect(recordPrefetch('post-0', 'en')).toEqual([]);

    expect(recordPrefetch('post-overflow', 'en')).toEqual([{ postId: 'post-1', language: 'en' }]);
  });

  it('tracks the same postId in different languages as separate entries', () => {
    recordPrefetch('a', 'en');
    recordPrefetch('a', 'ru');
    // Fill to exactly the cap (2 + 48 = 50) with distinct posts — no eviction yet.
    for (let i = 0; i < PREFETCH_LEDGER_CAP - 2; i++) {
      expect(recordPrefetch(`post-${i}`, 'en')).toEqual([]);
    }

    // The 51st entry evicts the true oldest, a/en — a/ru is untouched.
    expect(recordPrefetch('post-overflow', 'en')).toEqual([{ postId: 'a', language: 'en' }]);
  });

  it('forgetPrefetch drops every language entry for a postId so it is never evicted later', () => {
    recordPrefetch('a', 'en');
    recordPrefetch('a', 'ru');
    forgetPrefetch('a');

    for (let i = 0; i < PREFETCH_LEDGER_CAP; i++) {
      expect(recordPrefetch(`post-${i}`, 'en')).toEqual([]);
    }
  });
});
