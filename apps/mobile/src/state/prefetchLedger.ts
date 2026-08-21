import type { Language } from '@techtok/shared';
import { storage } from './storage';

const LEDGER_KEY = 'techtok.prefetchLedger';
export const PREFETCH_LEDGER_CAP = 50;

export interface PrefetchLedgerEntry {
  postId: string;
  language: Language;
}

function load(): PrefetchLedgerEntry[] {
  const raw = storage.getString(LEDGER_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function save(entries: PrefetchLedgerEntry[]): void {
  storage.set(LEDGER_KEY, JSON.stringify(entries));
}

export function recordPrefetch(postId: string, language: Language): PrefetchLedgerEntry[] {
  const entries = load().filter(
    (entry) => !(entry.postId === postId && entry.language === language),
  );
  entries.push({ postId, language });

  const evicted =
    entries.length > PREFETCH_LEDGER_CAP
      ? entries.splice(0, entries.length - PREFETCH_LEDGER_CAP)
      : [];
  save(entries);
  return evicted;
}

export function forgetPrefetch(postId: string): void {
  const entries = load();
  const next = entries.filter((entry) => entry.postId !== postId);
  if (next.length !== entries.length) save(next);
}
