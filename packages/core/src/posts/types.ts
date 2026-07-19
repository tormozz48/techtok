import type { Topic } from '@techtok/shared';

export type PostStatus = 'discovered' | 'ready' | 'failed';
export type TransformKind = 'llm' | 'excerpt' | 'skipped';

export interface NewPost {
  postId: string;
  url: string;
  canonicalUrl: string;
  sourceId: string;
  sourceName: string;
  origTitle: string;
  cardTitle: string;
  summary: string;
  whyItMatters?: string;
  excerpt: string;
  imageUrl?: string;
  primaryTopic: Topic;
  topics: Topic[];
  status: PostStatus;
  transform: TransformKind;
  publishedAt: string;
  s3RawKey?: string;
  lang?: string;
}

export interface PostRecord extends NewPost {
  ingestedAt: string;
  ttl: number;
  /** CDN URL of the mirrored article image (phase 4), set post-transform.
   * Falls back to the original hotlinked `imageUrl` when unset or on any
   * mirror failure — never blocks the post. */
  mirroredImageUrl?: string;
}
