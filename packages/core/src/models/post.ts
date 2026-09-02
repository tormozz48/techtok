import type { CompactFigure, Language, Topic } from '@techtok/shared';
import { getUnixTime } from 'date-fns';
import { encodeId } from '../db/ids';
import type {
  postCompacts,
  postFigures,
  posts,
  postTopics,
  postTranslations,
  topics,
} from '../db/schema';
import type { PostCandidate, PostRecord, PostStatus, TranslatedFields } from '../posts.types';
import { emptyToUndefined } from '../util/emptyToUndefined';

const BASE_LANGUAGE: Language = 'en';

type PostRow = typeof posts.$inferSelect;

type TopicRow = typeof topics.$inferSelect;

export type PostAggregateRow = PostRow & {
  source: { slug: string; name: string } | null;
  primaryTopic: TopicRow;
  translations: (typeof postTranslations.$inferSelect)[];
  topics: (typeof postTopics.$inferSelect & { topic: TopicRow })[];
  compacts: (typeof postCompacts.$inferSelect)[];
  figures: (typeof postFigures.$inferSelect)[];
};

export interface PostCandidateRow {
  readonly id: number;
  readonly publishedAt: string;
  readonly primaryTopic: Topic;
  readonly sourceId: string;
  readonly origTitle: string;
  readonly status: PostStatus;
  readonly duplicateOfPostId: number | null;
  readonly compactLangs: Language[];
}

export class Post {
  constructor(
    private readonly row: PostAggregateRow,
    private readonly dupCount: number | undefined,
  ) {}

  static toCandidate(row: PostCandidateRow): PostCandidate {
    return {
      postId: encodeId(row.id),
      publishedAt: row.publishedAt,
      primaryTopic: row.primaryTopic,
      sourceId: row.sourceId,
      origTitle: row.origTitle,
      status: row.status,
      compactLangs: emptyToUndefined(row.compactLangs),
      duplicateOf: row.duplicateOfPostId === null ? undefined : encodeId(row.duplicateOfPostId),
    };
  }

  toRecord(): PostRecord {
    const { row } = this;
    const base = this.baseTranslation;
    return {
      postId: encodeId(row.id),
      url: row.url,
      canonicalUrl: row.canonicalUrl,
      sourceId: row.source?.slug ?? '',
      sourceName: row.source?.name ?? '',
      origTitle: row.origTitle,
      cardTitle: base?.cardTitle ?? '',
      summary: base?.summary ?? '',
      whyItMatters: base?.whyItMatters ?? undefined,
      excerpt: row.excerpt,
      imageUrl: row.imageUrl ?? undefined,
      primaryTopic: row.primaryTopic.slug,
      topics: row.topics.map((link) => link.topic.slug),
      status: row.status,
      transform: row.transform,
      publishedAt: row.publishedAt,
      s3RawKey: row.s3RawKey ?? undefined,
      lang: row.lang ?? undefined,
      duplicateOf: row.duplicateOfPostId === null ? undefined : encodeId(row.duplicateOfPostId),
      ingestedAt: row.ingestedAt,
      ttl: getUnixTime(row.expiresAt),
      mirroredImageUrl: row.mirroredImageUrl ?? undefined,
      i18n: this.i18n,
      compactLangs: emptyToUndefined(row.compacts.map((compact) => compact.lang)),
      mirroredFigures: emptyToUndefined(row.figures.map(toFigure)),
      dupCount: this.dupCount,
    };
  }

  private get baseTranslation(): typeof postTranslations.$inferSelect | undefined {
    return this.row.translations.find((translation) => translation.lang === BASE_LANGUAGE);
  }

  private get i18n(): Partial<Record<Language, TranslatedFields>> {
    const i18n: Partial<Record<Language, TranslatedFields>> = {};
    for (const translation of this.row.translations) {
      if (translation.lang === BASE_LANGUAGE) continue;
      i18n[translation.lang] = {
        cardTitle: translation.cardTitle,
        summary: translation.summary,
        whyItMatters: translation.whyItMatters ?? undefined,
        translatedAt: translation.translatedAt,
      };
    }
    return i18n;
  }
}

function toFigure(row: typeof postFigures.$inferSelect): CompactFigure {
  return { url: row.url, caption: row.caption ?? undefined };
}
