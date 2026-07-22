import { describe, expect, it } from 'vitest';
import { isGenericImage } from './genericImageDenylist';

describe('isGenericImage', () => {
  it('flags the raw og:image tag value from an arXiv abstract page', () => {
    expect(isGenericImage('https://arxiv.org/static/browse/0.3.4/images/arxiv-logo-fb.png')).toBe(
      true,
    );
  });

  it('flags the arXiv logo regardless of the browse version segment', () => {
    expect(isGenericImage('https://arxiv.org/static/browse/1.2.3/images/arxiv-logo-fb.png')).toBe(
      true,
    );
  });

  // What @extractus/article-extractor actually resolves for arXiv posts in
  // practice — a different URL, host, and path shape than the raw og:image
  // tag above, confirmed by mirroring a live post (2026-07-22 dev-stage
  // verification) and finding the arXiv wordmark, not a paper image.
  it('flags the twitter:image variant article-extractor actually resolves', () => {
    expect(
      isGenericImage('https://static.arxiv.org/icons/twitter/arxiv-logo-twitter-square.png'),
    ).toBe(true);
  });

  it('does not flag a genuine article image', () => {
    expect(isGenericImage('https://cdn.arstechnica.net/wp-content/uploads/photo.jpg')).toBe(false);
  });

  it('does not flag an unrelated arxiv.org asset', () => {
    expect(isGenericImage('https://arxiv.org/static/css/arxiv.css')).toBe(false);
  });
});
