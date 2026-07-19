import type { PostRecord } from '@techtok/core';
import type { Card } from '@techtok/shared';

export function toCard(post: PostRecord, isBookmarked = false): Card {
  return {
    id: post.postId,
    title: post.cardTitle,
    summary: post.summary,
    whyItMatters: post.whyItMatters,
    imageUrl: post.imageUrl,
    sourceName: post.sourceName,
    url: post.url,
    primaryTopic: post.primaryTopic,
    topics: post.topics,
    publishedAt: post.publishedAt,
    transform: post.transform,
    isBookmarked,
  };
}
