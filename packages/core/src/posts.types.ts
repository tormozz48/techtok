import type { Topic } from '@techtok/shared';

export type PostStatus = 'discovered' | 'ready' | 'failed';
export type TransformKind = 'llm' | 'excerpt' | 'skipped';

export interface NewPost {
  readonly postId: string;
  readonly url: string;
  readonly canonicalUrl: string;
  readonly sourceId: string;
  readonly sourceName: string;
  readonly origTitle: string;
  readonly cardTitle: string;
  readonly summary: string;
  readonly whyItMatters?: string;
  readonly excerpt: string;
  readonly imageUrl?: string;
  readonly primaryTopic: Topic;
  readonly topics: Topic[];
  readonly status: PostStatus;
  readonly transform: TransformKind;
  readonly publishedAt: string;
  readonly s3RawKey?: string;
  readonly lang?: string;
  /** Set at ingest time (phase 4 experiment) when a cross-source title match
   * is found within the dedup window — the post is still created (data is
   * never lost) but excluded from feed queries by `buildFeed`. */
  readonly duplicateOf?: string;
}

export interface PostRecord extends NewPost {
  readonly ingestedAt: string;
  readonly ttl: number;
  /** CDN URL of the mirrored article image (phase 4), set post-transform.
   * Falls back to the original hotlinked `imageUrl` when unset or on any
   * mirror failure — never blocks the post. */
  readonly mirroredImageUrl?: string;
}
