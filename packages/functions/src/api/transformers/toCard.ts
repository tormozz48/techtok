import { type PostRecord, selectCardVariant } from '@techtok/core';
import type { Card, Language } from '@techtok/shared';

export function toCard(post: PostRecord, isBookmarked = false, lang: Language = 'en'): Card {
  const variant = selectCardVariant(post, lang);
  return {
    id: post.postId,
    title: variant.cardTitle,
    summary: variant.summary,
    whyItMatters: variant.whyItMatters,
    imageUrl: post.mirroredImageUrl ?? post.imageUrl,
    sourceName: post.sourceName,
    url: post.url,
    primaryTopic: post.primaryTopic,
    topics: post.topics,
    publishedAt: post.publishedAt,
    transform: post.transform,
    isBookmarked,
    servedLang: variant.servedLang,
    isTranslated: variant.isTranslated,
    compactLangs: post.compactLangs ?? [],
    sourceCount: post.dupCount ? post.dupCount + 1 : undefined,
  };
}
