import { describe, expect, it, vi } from 'vitest';
import type { SourceRecord } from '../sources.types';
import { createSourceWeightsCache } from './sourceWeightsCache';

function source(sourceId: string, weight: number): SourceRecord {
  return {
    sourceId,
    name: sourceId,
    rssUrl: `https://example.com/${sourceId}.xml`,
    defaultTopic: 'dev',
    weight,
    enabled: true,
    failCount: 0,
  };
}

describe('createSourceWeightsCache', () => {
  it('fetches once and reuses the result within the TTL window', async () => {
    const listEnabled = vi.fn().mockResolvedValue([source('a', 2)]);
    let now = 0;
    const cache = createSourceWeightsCache({ listEnabled }, 1000, () => now);

    const first = await cache.getSourceWeights();
    now += 500;
    const second = await cache.getSourceWeights();

    expect(listEnabled).toHaveBeenCalledTimes(1);
    expect(first.get('a')).toBe(2);
    expect(second).toBe(first);
  });

  it('refetches after the TTL elapses', async () => {
    const listEnabled = vi.fn().mockResolvedValue([source('a', 2)]);
    let now = 0;
    const cache = createSourceWeightsCache({ listEnabled }, 1000, () => now);

    await cache.getSourceWeights();
    now += 1001;
    await cache.getSourceWeights();

    expect(listEnabled).toHaveBeenCalledTimes(2);
  });

  it('maps sourceId to weight', async () => {
    const listEnabled = vi.fn().mockResolvedValue([source('a', 2), source('b', 5)]);
    const cache = createSourceWeightsCache({ listEnabled });

    const weights = await cache.getSourceWeights();

    expect(weights.get('a')).toBe(2);
    expect(weights.get('b')).toBe(5);
  });
});
