import type { PostRecord } from '@techtok/core';
import type { Card } from '@techtok/shared';

export function toCard(post: PostRecord): Card {
  return {
    id: post.postId,
    title: post.cardTitle,
    summary: post.summary,
    imageUrl: post.imageUrl,
    sourceName: post.sourceName,
    url: post.url,
    primaryTopic: post.primaryTopic,
    topics: post.topics,
    publishedAt: post.publishedAt,
  };
}
