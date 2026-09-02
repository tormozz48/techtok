import he from 'he';

const { decode } = he;

const TAG_RE = /<[^>]*>/g;
const IMG_SRC_RE = /<img\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/i;

export function toExcerpt(raw: string | undefined, maxLength = 280): string {
  if (!raw) return '';
  const collapsed = stripHtml(raw).replace(/\s+/g, ' ').trim();
  if (collapsed.length <= maxLength) return collapsed;
  return `${collapsed.slice(0, maxLength - 1).trimEnd()}…`;
}

export function firstImageSrc(html: string | undefined): string | undefined {
  if (!html) return undefined;
  const src = html.match(IMG_SRC_RE)?.[1];
  return src ? decode(src) : undefined;
}

function stripHtml(html: string): string {
  return decode(html.replace(TAG_RE, ' '));
}
