import type { CompactFigure, Language } from '@techtok/shared';
import { getUnixTime } from 'date-fns';
import type { postCompacts, postFigures, posts, postTopics, postTranslations } from '../db/schema';
import type { PostCandidate, PostRecord, TranslatedFields } from '../posts.types';
import { emptyToUndefined } from '../util/emptyToUndefined';

const BASE_LANGUAGE: Language = 'en';

type PostRow = typeof posts.$inferSelect;

export type PostAggregateRow = PostRow & {
  source: { name: string } | null;
  translations: (typeof postTranslations.$inferSelect)[];
  topics: (typeof postTopics.$inferSelect)[];
  compacts: (typeof postCompacts.$inferSelect)[];
  figures: (typeof postFigures.$inferSelect)[];
};

export type PostCandidateRow = Pick<
  PostRow,
  'postId' | 'publishedAt' | 'primaryTopic' | 'sourceId' | 'origTitle' | 'status' | 'duplicateOf'
> & { compactLangs: Language[] };

export class Post {
  constructor(
    private readonly row: PostAggregateRow,
    private readonly dupCount: number | undefined,
  ) {}

  static toCandidate(row: PostCandidateRow): PostCandidate {
    return {
      postId: row.postId,
      publishedAt: row.publishedAt,
      primaryTopic: row.primaryTopic,
      sourceId: row.sourceId,
      origTitle: row.origTitle,
      status: row.status,
      compactLangs: emptyToUndefined(row.compactLangs),
      duplicateOf: row.duplicateOf ?? undefined,
    };
  }

  toRecord(): PostRecord {
    const { row } = this;
    const base = this.baseTranslation;
    return {
      postId: row.postId,
      url: row.url,
      canonicalUrl: row.canonicalUrl,
      sourceId: row.sourceId,
      sourceName: row.source?.name ?? '',
      origTitle: row.origTitle,
      cardTitle: base?.cardTitle ?? '',
      summary: base?.summary ?? '',
      whyItMatters: base?.whyItMatters ?? undefined,
      excerpt: row.excerpt,
      imageUrl: row.imageUrl ?? undefined,
      primaryTopic: row.primaryTopic,
      topics: row.topics.map((topic) => topic.topic),
      status: row.status,
      transform: row.transform,
      publishedAt: row.publishedAt,
      s3RawKey: row.s3RawKey ?? undefined,
      lang: row.lang ?? undefined,
      duplicateOf: row.duplicateOf ?? undefined,
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
