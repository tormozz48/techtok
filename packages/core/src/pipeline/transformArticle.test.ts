import { describe, expect, it, vi } from 'vitest';
import type { TransformFields } from './transformArticle';
import { transformArticle } from './transformArticle';

const ARTICLE_HTML = `<!doctype html><html><head><title>Test Article</title></head><body>
<article>
<h1>Test Article Headline</h1>
<p>This is the first paragraph of a fairly long test article used to verify that the extraction library can pull out the main body text from a full HTML document that resembles a real news page layout with navigation and sidebars around it.</p>
<p>This is a second paragraph adding more content so that the content length threshold used by the extractor is comfortably exceeded by the combined text of the article body.</p>
</article>
</body></html>`;

function fakeDeps() {
  return {
    fetchRobotsTxt: vi.fn(async (): Promise<string | undefined> => undefined),
    fetchPage: vi.fn(async (): Promise<string> => ARTICLE_HTML),
    archiveRaw: vi.fn(async (_postId: string, _html: string) => {}),
    updatePost: vi.fn(async (_postId: string, _fields: TransformFields) => {}),
  };
}

const input = { postId: 'post1', url: 'https://example.com/article' };

describe('transformArticle', () => {
  it('fetches, archives, extracts, and updates the post with an improved excerpt', async () => {
    const deps = fakeDeps();

    const outcome = await transformArticle(input, deps);

    expect(outcome).toEqual({ degraded: false });
    expect(deps.archiveRaw).toHaveBeenCalledWith('post1', ARTICLE_HTML);
    expect(deps.updatePost).toHaveBeenCalledTimes(1);
    const fields = deps.updatePost.mock.calls[0]?.[1];
    expect(fields?.status).toBe('ready');
    expect(fields?.transform).toBe('excerpt');
    expect(fields?.s3RawKey).toBe('raw/post1.html');
    expect(fields?.excerpt).toContain('Test Article Headline');
    expect(fields?.summary).toBe(fields?.excerpt);
  });

  it('degrades without fetching the page when robots.txt disallows the url', async () => {
    const deps = fakeDeps();
    deps.fetchRobotsTxt.mockResolvedValueOnce('User-agent: *\nDisallow: /article');

    const outcome = await transformArticle(input, deps);

    expect(outcome.degraded).toBe(true);
    expect(outcome.reason).toContain('robots.txt');
    expect(deps.fetchPage).not.toHaveBeenCalled();
    expect(deps.archiveRaw).not.toHaveBeenCalled();
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
});
