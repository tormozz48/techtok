import { describe, expect, it, vi } from 'vitest';
import type { LlmProvider } from '../llm.types';
import { compactArticle } from './compactArticle';

const VALID_RESPONSE = JSON.stringify({
  blocks: [{ type: 'paragraph', text: 'A compact summary of the article.' }],
});

const input = {
  lang: 'en' as const,
  title: 'New battery material found',
  sourceName: 'ScienceDaily',
  articleText: 'Full article text.',
  figures: [],
};

function fakeProvider(complete: LlmProvider['complete']): LlmProvider {
  return { complete };
}

describe('compactArticle', () => {
  it('returns the validated blocks on a valid first response', async () => {
    const provider = fakeProvider(vi.fn(async (_prompt: string) => VALID_RESPONSE));

    const result = await compactArticle(input, provider);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.compact.blocks).toEqual([
        { type: 'paragraph', text: 'A compact summary of the article.' },
      ]);
    }
  });

  it('strips markdown code fences before parsing', async () => {
    const provider = fakeProvider(
      vi.fn(async (_prompt: string) => `\`\`\`json\n${VALID_RESPONSE}\n\`\`\``),
    );

    const result = await compactArticle(input, provider);

    expect(result.ok).toBe(true);
  });

  it('repairs on invalid JSON and succeeds on the second attempt', async () => {
    const complete = vi
      .fn<LlmProvider['complete']>()
      .mockResolvedValueOnce('not json at all')
      .mockResolvedValueOnce(VALID_RESPONSE);
    const provider = fakeProvider(complete);

    const result = await compactArticle(input, provider);

    expect(result.ok).toBe(true);
    expect(complete).toHaveBeenCalledTimes(2);
    const repairPrompt = complete.mock.calls[1]?.[0];
    expect(repairPrompt).toContain('Your previous response was invalid');
  });

  it('repairs on schema validation failure (bad block type) and succeeds on retry', async () => {
    const invalidBlock = JSON.stringify({ blocks: [{ type: 'video', text: 'nope' }] });
    const complete = vi
      .fn<LlmProvider['complete']>()
      .mockResolvedValueOnce(invalidBlock)
      .mockResolvedValueOnce(VALID_RESPONSE);
    const provider = fakeProvider(complete);

    const result = await compactArticle(input, provider);

    expect(result.ok).toBe(true);
    expect(complete).toHaveBeenCalledTimes(2);
  });

  it('reports failure without throwing when both attempts return invalid output', async () => {
    const provider = fakeProvider(vi.fn(async () => 'still not json'));

    const result = await compactArticle(input, provider);

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

    const result = await compactArticle(input, provider);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toContain('llm call failed: throttled');
    }
  });

  it('includes the figure list by index in the prompt', async () => {
    const complete = vi.fn(async (_prompt: string) => VALID_RESPONSE);
    const provider = fakeProvider(complete);

    await compactArticle({ ...input, figures: [{ index: 0, caption: 'A robot arm' }] }, provider);

    const prompt = complete.mock.calls[0]?.[0] as string;
    expect(prompt).toContain('0: A robot arm');
  });
});
