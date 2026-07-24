import type { CompactFigure } from '@techtok/shared';
import { describe, expect, it, vi } from 'vitest';
import type { CompactArticleResult } from '../llm/compactArticle';
import { generateContentArticle } from './contentArticle';

const SAMPLE_HTML = `<!doctype html><html><head><title>Test Article</title></head><body>
<article>
<h1>Test Article Headline</h1>
<p>This is the first paragraph of a fairly long test article used to verify that the extraction library can pull out the main body text from a full HTML document that resembles a real news page layout with navigation and sidebars around it.</p>
<p>This is a second paragraph adding more content so that the content length threshold used by the extractor is comfortably exceeded by the combined text of the article body.</p>
<img src="https://cdn.example.com/fig.jpg">
</article>
</body></html>`;

const SAMPLE_COMPACT: CompactArticleResult = {
  ok: true,
  compact: { blocks: [{ type: 'paragraph', text: 'A compact summary.' }] },
};

function fakeDeps() {
  return {
    compactEnabled: vi.fn(async (): Promise<boolean> => true),
    loadArticleHtml: vi.fn(async (): Promise<string> => SAMPLE_HTML),
    mirrorFigures: vi.fn(
      async (): Promise<CompactFigure[]> => [{ url: 'https://cdn.example.com/mirrored-fig.jpg' }],
    ),
    saveMirroredFigures: vi.fn(async (_figures: CompactFigure[]) => {}),
    generateCompact: vi.fn(async (): Promise<CompactArticleResult> => SAMPLE_COMPACT),
    writeContent: vi.fn(async () => {}),
  };
}

const input = {
  postId: 'post1',
  lang: 'en' as const,
  title: 'Title',
  sourceName: 'ScienceDaily',
  url: 'https://example.com/a',
};

describe('generateContentArticle', () => {
  it('generates and writes a compact article when everything succeeds', async () => {
    const deps = fakeDeps();

    const outcome = await generateContentArticle(input, deps);

    expect(outcome).toEqual({
      ok: true,
      blocks: [{ type: 'paragraph', text: 'A compact summary.' }],
      figures: [{ url: 'https://cdn.example.com/mirrored-fig.jpg' }],
    });
    expect(deps.writeContent).toHaveBeenCalledWith(
      [{ type: 'paragraph', text: 'A compact summary.' }],
      [{ url: 'https://cdn.example.com/mirrored-fig.jpg' }],
    );
  });

  it('mirrors and saves figures when this is the first job for the post', async () => {
    const deps = fakeDeps();

    await generateContentArticle(input, deps);

    expect(deps.mirrorFigures).toHaveBeenCalledTimes(1);
    expect(deps.saveMirroredFigures).toHaveBeenCalledWith([
      { url: 'https://cdn.example.com/mirrored-fig.jpg' },
    ]);
  });

  it('reuses already-mirrored figures without re-extracting or re-mirroring (D36)', async () => {
    const deps = fakeDeps();
    const existing: CompactFigure[] = [{ url: 'https://cdn.example.com/existing-fig.jpg' }];

    const outcome = await generateContentArticle({ ...input, mirroredFigures: existing }, deps);

    expect(deps.mirrorFigures).not.toHaveBeenCalled();
    expect(deps.saveMirroredFigures).not.toHaveBeenCalled();
    expect(outcome).toEqual({
      ok: true,
      blocks: [{ type: 'paragraph', text: 'A compact summary.' }],
      figures: existing,
    });
    expect(deps.generateCompact).toHaveBeenCalledWith(
      expect.objectContaining({ figures: [{ index: 0, caption: undefined }] }),
    );
    expect(deps.writeContent).toHaveBeenCalledWith(
      [{ type: 'paragraph', text: 'A compact summary.' }],
      existing,
    );
  });

  it('degrades without calling anything else when the source has compact disabled', async () => {
    const deps = fakeDeps();
    deps.compactEnabled.mockResolvedValue(false);

    const outcome = await generateContentArticle(input, deps);

    expect(outcome).toEqual({ ok: false, reason: 'compact reader disabled for this source' });
    expect(deps.loadArticleHtml).not.toHaveBeenCalled();
  });

  it('degrades when the article html cannot be loaded', async () => {
    const deps = fakeDeps();
    deps.loadArticleHtml.mockRejectedValue(new Error('archive missing, live fetch failed'));

    const outcome = await generateContentArticle(input, deps);

    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.reason).toContain('article unavailable');
  });

  it('degrades when extraction yields no usable text', async () => {
    const deps = fakeDeps();
    deps.loadArticleHtml.mockResolvedValue('<html><body></body></html>');

    const outcome = await generateContentArticle(input, deps);

    expect(outcome).toEqual({ ok: false, reason: 'extraction produced no usable text' });
    expect(deps.mirrorFigures).not.toHaveBeenCalled();
  });

  it('degrades when the llm call fails', async () => {
    const deps = fakeDeps();
    deps.generateCompact.mockResolvedValue({ ok: false, reason: 'schema validation failed' });

    const outcome = await generateContentArticle(input, deps);

    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.reason).toContain('schema validation failed');
    expect(deps.writeContent).not.toHaveBeenCalled();
  });

  it('lets an infra failure from writeContent propagate', async () => {
    const deps = fakeDeps();
    deps.writeContent.mockRejectedValue(new Error('s3 down'));

    await expect(generateContentArticle(input, deps)).rejects.toThrow('s3 down');
  });
});
