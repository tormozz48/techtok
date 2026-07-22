import { describe, expect, it, vi } from 'vitest';
import type { GenerateCardResult } from '../llm/generateCard';
import type { TransformFields } from './transformArticle';
import { transformArticle } from './transformArticle';

const ARTICLE_HTML = `<!doctype html><html><head><title>Test Article</title></head><body>
<article>
<h1>Test Article Headline</h1>
<p>This is the first paragraph of a fairly long test article used to verify that the extraction library can pull out the main body text from a full HTML document that resembles a real news page layout with navigation and sidebars around it.</p>
<p>This is a second paragraph adding more content so that the content length threshold used by the extractor is comfortably exceeded by the combined text of the article body.</p>
</article>
</body></html>`;

const ARTICLE_HTML_WITH_OG_IMAGE = ARTICLE_HTML.replace(
  '<head><title>Test Article</title></head>',
  '<head><title>Test Article</title><meta property="og:image" content="https://example.com/og-lead-image.jpg"></head>',
);

const ARTICLE_HTML_WITH_ARXIV_OG_IMAGE = ARTICLE_HTML.replace(
  '<head><title>Test Article</title></head>',
  '<head><title>Test Article</title><meta property="og:image" content="https://arxiv.org/static/browse/0.3.4/images/arxiv-logo-fb.png"></head>',
);

const SAMPLE_CARD: GenerateCardResult = {
  ok: true,
  card: {
    cardTitle: 'A Punchy Hook Title',
    summary: 'An LLM-written summary of the article.',
    whyItMatters: 'Because it does.',
    primaryTopic: 'dev',
    topics: ['dev'],
    lang: 'en',
  },
};

function fakeDeps() {
  return {
    fetchRobotsTxt: vi.fn(async (): Promise<string | undefined> => undefined),
    fetchPage: vi.fn(async (): Promise<string> => ARTICLE_HTML),
    archiveRaw: vi.fn(async (_postId: string, _html: string) => {}),
    checkDailyCap: vi.fn(async (): Promise<boolean> => true),
    generateCard: vi.fn(async (): Promise<GenerateCardResult> => SAMPLE_CARD),
    updatePost: vi.fn(async (_postId: string, _fields: TransformFields) => {}),
    mirrorImage: vi.fn(async (): Promise<string | undefined> => undefined),
  };
}

const input = {
  postId: 'post1',
  url: 'https://example.com/article',
  title: 'Test Article',
  sourceName: 'Example News',
};

describe('transformArticle', () => {
  it('fetches, archives, extracts, and produces an llm card when under the daily cap', async () => {
    const deps = fakeDeps();

    const outcome = await transformArticle(input, deps);

    expect(outcome).toEqual({ degraded: false });
    expect(deps.archiveRaw).toHaveBeenCalledWith('post1', ARTICLE_HTML);
    expect(deps.checkDailyCap).toHaveBeenCalledTimes(1);
    expect(deps.generateCard).toHaveBeenCalledWith({
      title: 'Test Article',
      sourceName: 'Example News',
      text: expect.stringContaining('Test Article Headline'),
    });
    expect(deps.updatePost).toHaveBeenCalledTimes(1);
    const fields = deps.updatePost.mock.calls[0]?.[1];
    expect(fields?.status).toBe('ready');
    expect(fields?.transform).toBe('llm');
    expect(fields?.s3RawKey).toBe('raw/post1.html');
    expect(fields?.excerpt).toContain('Test Article Headline');
    expect(fields?.summary).toBe('An LLM-written summary of the article.');
    expect(fields?.cardTitle).toBe('A Punchy Hook Title');
    expect(fields?.whyItMatters).toBe('Because it does.');
    expect(fields?.primaryTopic).toBe('dev');
    expect(fields?.topics).toEqual(['dev']);
    expect(fields?.lang).toBe('en');
  });

  it('marks the post skipped and never calls the LLM once the daily cap is reached', async () => {
    const deps = fakeDeps();
    deps.checkDailyCap.mockResolvedValueOnce(false);

    const outcome = await transformArticle(input, deps);

    expect(outcome).toEqual({ degraded: false });
    expect(deps.generateCard).not.toHaveBeenCalled();
    const fields = deps.updatePost.mock.calls[0]?.[1];
    expect(fields?.transform).toBe('skipped');
    expect(fields?.excerpt).toContain('Test Article Headline');
    expect(fields?.summary).toBe(fields?.excerpt);
    expect(fields?.cardTitle).toBeUndefined();
  });

  it('degrades to the excerpt card when the LLM call fails, without throwing', async () => {
    const deps = fakeDeps();
    deps.generateCard.mockResolvedValueOnce({ ok: false, reason: 'schema validation failed' });

    const outcome = await transformArticle(input, deps);

    expect(outcome.degraded).toBe(true);
    expect(outcome.reason).toContain('llm failed: schema validation failed');
    const fields = deps.updatePost.mock.calls[0]?.[1];
    expect(fields?.transform).toBe('excerpt');
    expect(fields?.summary).toBe(fields?.excerpt);
    expect(fields?.cardTitle).toBeUndefined();
  });

  it('degrades without fetching the page when robots.txt disallows the url', async () => {
    const deps = fakeDeps();
    deps.fetchRobotsTxt.mockResolvedValueOnce('User-agent: *\nDisallow: /article');

    const outcome = await transformArticle(input, deps);

    expect(outcome.degraded).toBe(true);
    expect(outcome.reason).toContain('robots.txt');
    expect(deps.fetchPage).not.toHaveBeenCalled();
    expect(deps.archiveRaw).not.toHaveBeenCalled();
    expect(deps.checkDailyCap).not.toHaveBeenCalled();
    expect(deps.generateCard).not.toHaveBeenCalled();
    const fields = deps.updatePost.mock.calls[0]?.[1];
    expect(fields).toEqual({
      status: 'ready',
      transform: 'excerpt',
      s3RawKey: undefined,
    });
  });

  it('degrades when the page fetch fails, without archiving or throwing', async () => {
    const deps = fakeDeps();
    deps.fetchPage.mockRejectedValueOnce(new Error('timed out'));

    const outcome = await transformArticle(input, deps);

    expect(outcome.degraded).toBe(true);
    expect(outcome.reason).toContain('timed out');
    expect(deps.archiveRaw).not.toHaveBeenCalled();
    expect(deps.checkDailyCap).not.toHaveBeenCalled();
    const fields = deps.updatePost.mock.calls[0]?.[1];
    expect(fields?.excerpt).toBeUndefined();
  });

  it('still archives a successfully-fetched page even when extraction yields nothing', async () => {
    const deps = fakeDeps();
    deps.fetchPage.mockResolvedValueOnce('<html><body><p>too short</p></body></html>');

    const outcome = await transformArticle(input, deps);

    expect(outcome.degraded).toBe(true);
    expect(outcome.reason).toContain('extraction');
    expect(deps.archiveRaw).toHaveBeenCalledTimes(1);
    expect(deps.checkDailyCap).not.toHaveBeenCalled();
    const fields = deps.updatePost.mock.calls[0]?.[1];
    expect(fields?.s3RawKey).toBe('raw/post1.html');
    expect(fields?.excerpt).toBeUndefined();
  });

  it('propagates archiveRaw failures instead of swallowing them', async () => {
    const deps = fakeDeps();
    deps.archiveRaw.mockRejectedValueOnce(new Error('s3 down'));

    await expect(transformArticle(input, deps)).rejects.toThrow('s3 down');
  });

  it('propagates updatePost failures instead of swallowing them', async () => {
    const deps = fakeDeps();
    deps.updatePost.mockRejectedValueOnce(new Error('ddb down'));

    await expect(transformArticle(input, deps)).rejects.toThrow('ddb down');
  });

  it('never calls mirrorImage when the post has no original imageUrl', async () => {
    const deps = fakeDeps();

    await transformArticle(input, deps);

    expect(deps.mirrorImage).not.toHaveBeenCalled();
    const fields = deps.updatePost.mock.calls[0]?.[1];
    expect(fields?.mirroredImageUrl).toBeUndefined();
  });

  it('mirrors the image and persists the CDN url when one is available', async () => {
    const deps = fakeDeps();
    deps.mirrorImage.mockResolvedValueOnce('https://cdn.example.com/images/post1.jpg');
    const inputWithImage = { ...input, imageUrl: 'https://source.example.com/a.jpg' };

    const outcome = await transformArticle(inputWithImage, deps);

    expect(outcome).toEqual({ degraded: false });
    expect(deps.mirrorImage).toHaveBeenCalledWith('post1', 'https://source.example.com/a.jpg');
    const fields = deps.updatePost.mock.calls[0]?.[1];
    expect(fields?.mirroredImageUrl).toBe('https://cdn.example.com/images/post1.jpg');
  });

  it('leaves mirroredImageUrl unset (falls back to the original) when mirroring fails, without affecting degraded status', async () => {
    const deps = fakeDeps();
    deps.mirrorImage.mockResolvedValueOnce(undefined);
    const inputWithImage = { ...input, imageUrl: 'https://source.example.com/a.jpg' };

    const outcome = await transformArticle(inputWithImage, deps);

    expect(outcome).toEqual({ degraded: false });
    const fields = deps.updatePost.mock.calls[0]?.[1];
    expect(fields?.mirroredImageUrl).toBeUndefined();
  });

  it("mirrors the page's og:image (D24) when the post had no ingest-time imageUrl", async () => {
    const deps = fakeDeps();
    deps.fetchPage.mockResolvedValueOnce(ARTICLE_HTML_WITH_OG_IMAGE);
    deps.mirrorImage.mockResolvedValueOnce('https://cdn.example.com/images/post1.jpg');

    const outcome = await transformArticle(input, deps);

    expect(outcome).toEqual({ degraded: false });
    expect(deps.mirrorImage).toHaveBeenCalledWith('post1', 'https://example.com/og-lead-image.jpg');
    const fields = deps.updatePost.mock.calls[0]?.[1];
    expect(fields?.mirroredImageUrl).toBe('https://cdn.example.com/images/post1.jpg');
  });

  it('prefers the ingest-time imageUrl over the og:image when both are available', async () => {
    const deps = fakeDeps();
    deps.fetchPage.mockResolvedValueOnce(ARTICLE_HTML_WITH_OG_IMAGE);
    const inputWithImage = { ...input, imageUrl: 'https://source.example.com/a.jpg' };

    await transformArticle(inputWithImage, deps);

    expect(deps.mirrorImage).toHaveBeenCalledWith('post1', 'https://source.example.com/a.jpg');
  });

  it('never mirrors a known-generic og:image (arXiv logo)', async () => {
    const deps = fakeDeps();
    deps.fetchPage.mockResolvedValueOnce(ARTICLE_HTML_WITH_ARXIV_OG_IMAGE);

    await transformArticle(input, deps);

    expect(deps.mirrorImage).not.toHaveBeenCalled();
    const fields = deps.updatePost.mock.calls[0]?.[1];
    expect(fields?.mirroredImageUrl).toBeUndefined();
  });
});
