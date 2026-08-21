import type { CompactFigure, Language, Topic, TransformKind } from '@techtok/shared';

export type { TransformKind };
export type PostStatus = 'discovered' | 'ready' | 'failed';

export interface TranslatedFields {
  readonly cardTitle: string;
  readonly summary: string;
  readonly whyItMatters?: string;
  readonly translatedAt: string;
}

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
  readonly duplicateOf?: string;
}

export interface PostRecord extends NewPost {
  readonly ingestedAt: string;
  readonly ttl: number;
  readonly mirroredImageUrl?: string;
  readonly i18n: Partial<Record<Language, TranslatedFields>>;
  readonly compactLangs?: Language[];
  readonly mirroredFigures?: CompactFigure[];
  readonly dupCount?: number;
}
