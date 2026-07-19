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
  excerpt: string;
  imageUrl?: string;
  primaryTopic: Topic;
  topics: Topic[];
  status: PostStatus;
  transform: TransformKind;
  publishedAt: string;
  s3RawKey?: string;
}

export interface PostRecord extends NewPost {
  ingestedAt: string;
  ttl: number;
}
