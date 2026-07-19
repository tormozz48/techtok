import type { SourcesRepo } from '../repos/sourcesRepo';

const DEFAULT_TTL_MS = 5 * 60 * 1000;

export interface SourceWeightsCache {
  getSourceWeights(): Promise<Map<string, number>>;
}

/**
 * Caches `Sources.weight` per sourceId for `ttlMs` (Sources is a tiny scan-friendly
 * table, so a short in-memory cache avoids a scan on every feed request without
 * risking meaningfully stale weights).
 */
export function createSourceWeightsCache(
  sourcesRepo: Pick<SourcesRepo, 'listEnabled'>,
  ttlMs = DEFAULT_TTL_MS,
  now: () => number = Date.now,
): SourceWeightsCache {
  let cached: Map<string, number> | undefined;
  let fetchedAt = 0;

  return {
    async getSourceWeights(): Promise<Map<string, number>> {
      if (cached && now() - fetchedAt < ttlMs) {
        return cached;
      }
      const sources = await sourcesRepo.listEnabled();
      cached = new Map(sources.map((source) => [source.sourceId, source.weight]));
      fetchedAt = now();
      return cached;
    },
  };
}
