import { describe, expect, it, vi } from 'vitest';
import type { TranslateCardResult } from '../llm/translateCard';
import { translateArticle } from './translateArticle';

const SAMPLE_TRANSLATION: TranslateCardResult = {
  ok: true,
  translation: {
    cardTitle: 'Переведённый заголовок',
    summary: 'Переведённое содержание.',
    whyItMatters: 'Почему это важно.',
  },
};

function fakeDeps() {
  return {
    translateCard: vi.fn(async (): Promise<TranslateCardResult> => SAMPLE_TRANSLATION),
    writeTranslation: vi.fn(async () => {}),
  };
}

const input = {
  postId: 'post1',
  lang: 'ru' as const,
  cardTitle: 'English Title',
  summary: 'English summary.',
  whyItMatters: 'English why it matters.',
};

describe('translateArticle', () => {
  it('writes the translation when the LLM succeeds', async () => {
    const deps = fakeDeps();

    const outcome = await translateArticle(input, deps);

    expect(outcome).toEqual({ translated: true });
    expect(deps.writeTranslation).toHaveBeenCalledWith(
      'post1',
      'ru',
      expect.objectContaining({
        cardTitle: 'Переведённый заголовок',
        summary: 'Переведённое содержание.',
        whyItMatters: 'Почему это важно.',
        translatedAt: expect.any(String),
      }),
    );
  });

  it('reports failure without writing anything on an LLM content failure', async () => {
    const deps = fakeDeps();
    deps.translateCard.mockResolvedValue({ ok: false, reason: 'schema validation failed' });

    const outcome = await translateArticle(input, deps);

    expect(outcome.translated).toBe(false);
    expect(outcome.reason).toContain('schema validation failed');
    expect(deps.writeTranslation).not.toHaveBeenCalled();
  });

  it('lets an infra failure from writeTranslation propagate', async () => {
    const deps = fakeDeps();
    deps.writeTranslation.mockRejectedValue(new Error('ddb down'));

    await expect(translateArticle(input, deps)).rejects.toThrow('ddb down');
  });
});
