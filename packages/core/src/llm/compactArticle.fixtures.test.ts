import { describe, expect, it } from 'vitest';
import type { LlmProvider } from '../llm.types';
import { COMPACT_FIXTURES } from './__fixtures__/compactFixtures';
import { compactArticle } from './compactArticle';

describe('compactArticle golden fixtures', () => {
  it.each(COMPACT_FIXTURES)(
    '$name produces a valid compact article',
    async ({ input, llmResponse }) => {
      const provider: LlmProvider = { complete: async () => llmResponse };

      const result = await compactArticle(input, provider);

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.compact.blocks.length).toBeGreaterThan(0);
      for (const block of result.compact.blocks) {
        if (block.type === 'image') {
          expect(input.figures.some((f) => f.index === block.figureIndex)).toBe(true);
        }
      }
    },
  );
});
