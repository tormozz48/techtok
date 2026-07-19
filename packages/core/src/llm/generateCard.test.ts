import { describe, expect, it, vi } from 'vitest';
import { generateCard } from './generateCard';
import type { LlmProvider } from './types';

const VALID_RESPONSE = JSON.stringify({
  cardTitle: 'Scientists Find New Battery Material',
  summary:
    'Researchers discovered a material that could double battery life. Early tests are promising.',
  whyItMatters: 'Longer-lasting batteries could reshape phones and EVs alike.',
  primaryTopic: 'science',
  topics: ['science', 'gadgets'],
  lang: 'en',
});

const input = {
  title: 'New battery material found',
  sourceName: 'ScienceDaily',
  text: 'Full article text.',
};

function fakeProvider(complete: LlmProvider['complete']): LlmProvider {
  return { complete };
}

describe('generateCard', () => {
  it('returns the validated card on a valid first response', async () => {
    const provider = fakeProvider(vi.fn(async (_prompt: string) => VALID_RESPONSE));

    const result = await generateCard(input, provider);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.card.cardTitle).toBe('Scientists Find New Battery Material');
      expect(result.card.primaryTopic).toBe('science');
    }
  });

  it('strips markdown code fences before parsing', async () => {
    const provider = fakeProvider(
      vi.fn(async (_prompt: string) => `\`\`\`json\n${VALID_RESPONSE}\n\`\`\``),
    );

    const result = await generateCard(input, provider);

    expect(result.ok).toBe(true);
  });

  it('repairs on invalid JSON and succeeds on the second attempt', async () => {
    const complete = vi
      .fn<LlmProvider['complete']>()
      .mockResolvedValueOnce('not json at all')
      .mockResolvedValueOnce(VALID_RESPONSE);
    const provider = fakeProvider(complete);

    const result = await generateCard(input, provider);

    expect(result.ok).toBe(true);
    expect(complete).toHaveBeenCalledTimes(2);
    const repairPrompt = complete.mock.calls[1]?.[0];
    expect(repairPrompt).toContain('Your previous response was invalid');
  });

  it('repairs on schema validation failure (bad topic) and succeeds on retry', async () => {
    const invalidTopic = JSON.stringify({
      ...JSON.parse(VALID_RESPONSE),
      primaryTopic: 'not-a-topic',
    });
    const complete = vi
      .fn<LlmProvider['complete']>()
      .mockResolvedValueOnce(invalidTopic)
      .mockResolvedValueOnce(VALID_RESPONSE);
    const provider = fakeProvider(complete);

    const result = await generateCard(input, provider);

    expect(result.ok).toBe(true);
    expect(complete).toHaveBeenCalledTimes(2);
  });

  it('reports failure without throwing when both attempts return invalid output', async () => {
    const provider = fakeProvider(vi.fn(async () => 'still not json'));

    const result = await generateCard(input, provider);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toContain('invalid JSON');
      expect(result.reason).toContain('repair retry');
    }
  });

  it('reports failure without throwing when the provider call rejects', async () => {
    const provider = fakeProvider(
      vi.fn(async (_prompt: string) => {
        throw new Error('throttled');
      }),
    );

    const result = await generateCard(input, provider);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toContain('llm call failed: throttled');
    }
  });

  it('truncates article text to ~4000 chars before prompting', async () => {
    const complete = vi.fn(async (_prompt: string) => VALID_RESPONSE);
    const provider = fakeProvider(complete);
    const longText = 'a'.repeat(5000);

    await generateCard({ ...input, text: longText }, provider);

    const prompt = complete.mock.calls[0]?.[0] as string;
    expect(prompt).not.toContain('a'.repeat(4001));
  });
});
