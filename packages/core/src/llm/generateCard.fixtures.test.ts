import { describe, expect, it } from 'vitest';
import type { LlmProvider } from '../llm.types';
import { CARD_FIXTURES } from './__fixtures__/cardFixtures';
import { generateCard } from './generateCard';

describe('generateCard golden fixtures', () => {
  it.each(CARD_FIXTURES)('$name produces a valid card', async ({ input, llmResponse }) => {
    const provider: LlmProvider = { complete: async () => llmResponse };

    const result = await generateCard(input, provider);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.card.cardTitle.length).toBeLessThanOrEqual(80);
    expect(result.card.summary.length).toBeLessThanOrEqual(320);
    expect(result.card.whyItMatters.length).toBeLessThanOrEqual(160);
    expect(result.card.topics).toContain(result.card.primaryTopic);
  });
});
