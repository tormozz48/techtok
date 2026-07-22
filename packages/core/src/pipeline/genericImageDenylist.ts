/**
 * Known-generic images that should never be treated as a real article image
 * (DESIGN §2 D24). Currently just arXiv: every abstract page resolves to the
 * same static arXiv logo rather than anything specific to the article —
 * confirmed live on `arxiv.org/abs/*`. Two different URLs have been observed
 * for it in practice: the raw `<meta property="og:image">` tag points at
 * `/static/browse/<version>/images/arxiv-logo-fb.png`, but `@extractus/
 * article-extractor`'s own metadata resolution (which prefers other tags,
 * e.g. twitter:image, over a page's plain og:image in some cases) actually
 * returns `https://static.arxiv.org/icons/twitter/arxiv-logo-twitter-square.png`
 * — confirmed by mirroring a live post and finding the arXiv wordmark, not a
 * paper-specific image. Matching on the shared "arxiv-logo" filename token
 * (rather than a full path) catches both, and any other same-family variant
 * arXiv might serve. Extend this list if another source's image turns out to
 * be consistently generic too.
 */
const GENERIC_IMAGE_PATTERNS: readonly RegExp[] = [/arxiv-logo/i];

export function isGenericImage(url: string): boolean {
  return GENERIC_IMAGE_PATTERNS.some((pattern) => pattern.test(url));
}
