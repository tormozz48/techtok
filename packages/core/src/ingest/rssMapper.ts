import type { NewPost } from '../posts.types';
import type { SourceRecord } from '../sources.types';
import { canonicalizeUrl, hashPostId } from '../url/canonicalize';
import { firstImageSrc, toExcerpt } from './htmlText';

/** A `media:content`/`media:thumbnail` node as rss-parser's `customFields`
 * (see `ingestSource.ts`) hands it back — attributes live under `$`;
 * `media:content` may carry other namespaced children (credit, text, a
 * nested thumbnail) that this mapper doesn't need and ignores. */
export interface MediaNode {
  readonly $?: {
    readonly url?: string;
    readonly medium?: string;
    readonly type?: string;
  };
}

export interface FeedEntry {
  readonly title?: string;
  readonly link?: string;
  readonly isoDate?: string;
  readonly pubDate?: string;
  readonly summary?: string;
  readonly contentSnippet?: string;
  readonly content?: string;
  readonly enclosure?: { readonly url?: string };
  readonly mediaContent?: readonly MediaNode[];
  readonly mediaThumbnail?: readonly MediaNode[];
  /** RSS's `content:encoded` module — already parsed by rss-parser's default
   * field list (no `customFields` entry needed), just never typed/read
   * before now. Holds the full article HTML, unlike `content`/`summary`
   * which for RSS 2.0 feeds is only the short `<description>`. */
  readonly 'content:encoded'?: string;
}

type MapperSource = Pick<SourceRecord, 'sourceId' | 'name' | 'defaultTopic'>;

/** First node whose `url` attribute looks like an image — skips a
 * `media:content` entry that's explicitly typed as something else (e.g. a
 * video enclosure with `medium="video"` or `type="video/mp4"`). */
function firstMediaImageUrl(nodes: readonly MediaNode[] | undefined): string | undefined {
  if (!nodes) return undefined;
  for (const node of nodes) {
    const attrs = node.$;
    if (!attrs?.url) continue;
    if (attrs.medium && attrs.medium !== 'image') continue;
    if (attrs.type && !attrs.type.startsWith('image/')) continue;
    return attrs.url;
  }
  return undefined;
}

export function mapEntryToPost(entry: FeedEntry, source: MapperSource): NewPost | undefined {
  const link = entry.link?.trim();
  const title = entry.title?.trim();
  if (!link || !title) return undefined;

  const canonicalUrl = canonicalizeUrl(link);
  const excerptSource = entry.summary ?? entry.contentSnippet ?? entry.content;
  const excerpt = toExcerpt(excerptSource);
  // Fallback chain, DESIGN §2 D24: enclosure -> media:content -> media:thumbnail
  // -> <img> in content:encoded -> <img> in content -> <img> in summary.
  const imageUrl =
    entry.enclosure?.url ??
    firstMediaImageUrl(entry.mediaContent) ??
    firstMediaImageUrl(entry.mediaThumbnail) ??
    firstImageSrc(entry['content:encoded']) ??
    firstImageSrc(entry.content) ??
    firstImageSrc(entry.summary);

  return {
    postId: hashPostId(canonicalUrl),
    url: link,
    canonicalUrl,
    sourceId: source.sourceId,
    sourceName: source.name,
    origTitle: title,
    cardTitle: title,
    summary: excerpt,
    excerpt,
    imageUrl,
    primaryTopic: source.defaultTopic,
    topics: [source.defaultTopic],
    status: 'discovered',
    transform: 'excerpt',
    publishedAt: parsePublishedAt(entry),
  };
}

function parsePublishedAt(entry: FeedEntry): string {
  const candidate = entry.isoDate ?? entry.pubDate;
  if (candidate) {
    const date = new Date(candidate);
    if (!Number.isNaN(date.getTime())) {
      return date.toISOString();
    }
  }
  return new Date().toISOString();
}
