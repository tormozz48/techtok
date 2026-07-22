import { describe, expect, it, vi } from 'vitest';
import { type BackfillImagesDeps, backfillImages } from './backfillImages';

// Long enough to clear @extractus/article-extractor's own content-length
// threshold (200 chars) — below that it returns null for the whole result,
// image included, same constraint transformArticle.test.ts's fixture works
// around.
const ARTICLE_HTML_WITH_IMAGE = `<!doctype html><html><head><title>Archived Article</title>
<meta property="og:image" content="https://example.com/lead.jpg">
</head><body><article>
<h1>Archived Article Headline</h1>
<p>This is the first paragraph of a fairly long archived article used to verify that the backfill can pull the og:image out of a page that was fetched and stored long before this backfill ever ran.</p>
<p>A second paragraph adds enough additional content that the extractor's own content-length threshold is comfortably exceeded by the combined article body text.</p>
</article></body></html>`;

const ARTICLE_HTML_NO_IMAGE = ARTICLE_HTML_WITH_IMAGE.replace(
  '<meta property="og:image" content="https://example.com/lead.jpg">',
  '',
);

const ARTICLE_HTML_ARXIV_IMAGE = ARTICLE_HTML_WITH_IMAGE.replace(
  'https://example.com/lead.jpg',
  'https://arxiv.org/static/browse/0.3.4/images/arxiv-logo-fb.png',
);

const candidateA = { postId: 'post-a', url: 'https://example.com/a', s3RawKey: 'raw/post-a.html' };
const candidateB = { postId: 'post-b', url: 'https://example.com/b', s3RawKey: 'raw/post-b.html' };

function fakeDeps(): BackfillImagesDeps & {
  nextCandidates: ReturnType<typeof vi.fn>;
  getRawHtml: ReturnType<typeof vi.fn>;
  mirrorImage: ReturnType<typeof vi.fn>;
  updateMirroredImage: ReturnType<typeof vi.fn>;
  onError: ReturnType<typeof vi.fn>;
} {
  return {
    nextCandidates: vi
      .fn()
      .mockResolvedValueOnce({ candidates: [candidateA], nextBefore: undefined }),
    getRawHtml: vi.fn(async () => ARTICLE_HTML_WITH_IMAGE),
    mirrorImage: vi.fn(async (): Promise<string | undefined> => 'https://cdn.example.com/a.jpg'),
    updateMirroredImage: vi.fn(async () => {}),
    onError: vi.fn((_postId: string, _error: unknown) => {}),
  };
}

describe('backfillImages', () => {
  it('mirrors a real og:image from the archived html and updates the post', async () => {
    const deps = fakeDeps();

    const result = await backfillImages(deps);

    expect(result).toEqual({ scanned: 1, mirrored: 1, skipped: 0 });
    expect(deps.getRawHtml).toHaveBeenCalledWith('raw/post-a.html');
    expect(deps.mirrorImage).toHaveBeenCalledWith('post-a', 'https://example.com/lead.jpg');
    expect(deps.updateMirroredImage).toHaveBeenCalledWith(
      'post-a',
      'https://cdn.example.com/a.jpg',
    );
    expect(deps.onError).not.toHaveBeenCalled();
  });

  it('skips a candidate whose archived html has no og:image', async () => {
    const deps = fakeDeps();
    deps.getRawHtml.mockResolvedValueOnce(ARTICLE_HTML_NO_IMAGE);

    const result = await backfillImages(deps);

    expect(result).toEqual({ scanned: 1, mirrored: 0, skipped: 1 });
    expect(deps.mirrorImage).not.toHaveBeenCalled();
    expect(deps.updateMirroredImage).not.toHaveBeenCalled();
  });

  it('skips a known-generic og:image (arXiv) without mirroring', async () => {
    const deps = fakeDeps();
    deps.getRawHtml.mockResolvedValueOnce(ARTICLE_HTML_ARXIV_IMAGE);

    const result = await backfillImages(deps);

    expect(result).toEqual({ scanned: 1, mirrored: 0, skipped: 1 });
    expect(deps.mirrorImage).not.toHaveBeenCalled();
  });

  it('skips when mirroring itself fails, without updating the post', async () => {
    const deps = fakeDeps();
    deps.mirrorImage.mockResolvedValueOnce(undefined);

    const result = await backfillImages(deps);

    expect(result).toEqual({ scanned: 1, mirrored: 0, skipped: 1 });
    expect(deps.updateMirroredImage).not.toHaveBeenCalled();
  });

  it('counts a getRawHtml failure as skipped, reports it via onError, and keeps going', async () => {
    const deps = fakeDeps();
    deps.nextCandidates.mockReset().mockResolvedValueOnce({
      candidates: [candidateA, candidateB],
      nextBefore: undefined,
    });
    deps.getRawHtml.mockRejectedValueOnce(new Error('NoSuchKey'));

    const result = await backfillImages(deps);

    expect(result).toEqual({ scanned: 2, mirrored: 1, skipped: 1 });
    expect(deps.onError).toHaveBeenCalledWith('post-a', expect.any(Error));
    expect(deps.mirrorImage).toHaveBeenCalledWith('post-b', 'https://example.com/lead.jpg');
  });

  it('continues paginating past a page with zero eligible candidates', async () => {
    const deps = fakeDeps();
    deps.nextCandidates
      .mockReset()
      .mockResolvedValueOnce({ candidates: [], nextBefore: '2026-01-01T00:00:00.000Z' })
      .mockResolvedValueOnce({ candidates: [candidateA], nextBefore: undefined });

    const result = await backfillImages(deps);

    expect(result).toEqual({ scanned: 1, mirrored: 1, skipped: 0 });
    expect(deps.nextCandidates).toHaveBeenCalledTimes(2);
    expect(deps.nextCandidates).toHaveBeenNthCalledWith(1, undefined);
    expect(deps.nextCandidates).toHaveBeenNthCalledWith(2, '2026-01-01T00:00:00.000Z');
  });

  it('stops once nextBefore comes back undefined, without an extra page fetch', async () => {
    const deps = fakeDeps();

    await backfillImages(deps);

    expect(deps.nextCandidates).toHaveBeenCalledTimes(1);
  });
});
