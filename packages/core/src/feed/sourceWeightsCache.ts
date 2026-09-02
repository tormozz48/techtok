import type { SourcesRepo } from '../repos/sourcesRepo';
import { isCompactEnabled } from '../sources.types';

const DEFAULT_TTL_MS = 5 * 60 * 1000;

export interface SourceWeightsCache {
  getSourceWeights(): Promise<Map<string, number>>;
  getCompactDisabledSourceIds(): Promise<Set<string>>;
}

export function createSourceWeightsCache(
  sourcesRepo: Pick<SourcesRepo, 'listEnabled'>,
  ttlMs = DEFAULT_TTL_MS,
  now: () => number = Date.now,
): SourceWeightsCache {
  let weights: Map<string, number> | undefined;
  let compactDisabled: Set<string> | undefined;
  let fetchedAt = 0;

  async function refresh(): Promise<void> {
    if (weights && now() - fetchedAt < ttlMs) {
      return;
    }
    const sources = await sourcesRepo.listEnabled();
    weights = new Map(sources.map((source) => [source.sourceId, source.weight]));
    compactDisabled = new Set(
      sources.filter((source) => !isCompactEnabled(source)).map((source) => source.sourceId),
    );
    fetchedAt = now();
  }

  return {
    async getSourceWeights(): Promise<Map<string, number>> {
      await refresh();
      return weights as Map<string, number>;
    },
    async getCompactDisabledSourceIds(): Promise<Set<string>> {
      await refresh();
      return compactDisabled as Set<string>;
    },
  };
}
