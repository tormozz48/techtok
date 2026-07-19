import type { NewPost } from '../posts/types';
import type { SourceRecord } from '../sources/types';
import { canonicalizeUrl, hashPostId } from '../url/canonicalize';
import { firstImageSrc, toExcerpt } from './htmlText';

export interface FeedEntry {
  title?: string;
  link?: string;
  isoDate?: string;
  pubDate?: string;
  summary?: string;
  contentSnippet?: string;
  content?: string;
  enclosure?: { url?: string };
}

type MapperSource = Pick<SourceRecord, 'sourceId' | 'name' | 'defaultTopic'>;

export function mapEntryToPost(entry: FeedEntry, source: MapperSource): NewPost | undefined {
  const link = entry.link?.trim();
  const title = entry.title?.trim();
  if (!link || !title) return undefined;

  const canonicalUrl = canonicalizeUrl(link);
  const excerptSource = entry.summary ?? entry.contentSnippet ?? entry.content;
  const excerpt = toExcerpt(excerptSource);
  const imageUrl =
    entry.enclosure?.url ?? firstImageSrc(entry.content) ?? firstImageSrc(entry.summary);

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
