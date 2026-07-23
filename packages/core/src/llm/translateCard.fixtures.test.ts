import { describe, expect, it } from 'vitest';
import type { LlmProvider } from '../llm.types';
import { TRANSLATION_FIXTURES } from './__fixtures__/translationFixtures';
import { translateCard } from './translateCard';

describe('translateCard golden fixtures', () => {
  it.each(TRANSLATION_FIXTURES)(
    '$name produces a valid translation',
    async ({ input, llmResponse }) => {
      const provider: LlmProvider = { complete: async () => llmResponse };

      const result = await translateCard(input, provider);

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.translation.cardTitle.length).toBeLessThanOrEqual(80);
      expect(result.translation.summary.length).toBeLessThanOrEqual(320);
      if (result.translation.whyItMatters) {
        expect(result.translation.whyItMatters.length).toBeLessThanOrEqual(160);
      }
    },
  );
});
