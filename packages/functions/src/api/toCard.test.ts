import type { PostRecord } from '@techtok/core';
import { describe, expect, it } from 'vitest';
import { toCard } from './toCard';

const post: PostRecord = {
  postId: 'abc123',
  url: 'https://example.com/a',
  canonicalUrl: 'https://example.com/a',
  sourceId: 'hn',
  sourceName: 'Hacker News',
  origTitle: 'Original title',
  cardTitle: 'Original title',
  summary: 'An excerpt of the article.',
  excerpt: 'An excerpt of the article.',
  imageUrl: 'https://example.com/a.jpg',
  primaryTopic: 'dev',
  topics: ['dev'],
  status: 'ready',
  transform: 'excerpt',
  publishedAt: '2026-07-18T00:00:00.000Z',
  ingestedAt: '2026-07-18T00:05:00.000Z',
  ttl: 1234567890,
};

describe('toCard', () => {
  it('maps a post record to the public card DTO', () => {
    expect(toCard(post)).toEqual({
      id: 'abc123',
      title: 'Original title',
      summary: 'An excerpt of the article.',
      imageUrl: 'https://example.com/a.jpg',
      sourceName: 'Hacker News',
      url: 'https://example.com/a',
      primaryTopic: 'dev',
      topics: ['dev'],
      publishedAt: '2026-07-18T00:00:00.000Z',
      transform: 'excerpt',
    });
  });

  it('carries whyItMatters and an llm transform through for llm-transformed posts', () => {
    const llmPost: PostRecord = {
      ...post,
      transform: 'llm',
      whyItMatters: 'Because it does.',
    };

    const card = toCard(llmPost);

    expect(card.whyItMatters).toBe('Because it does.');
    expect(card.transform).toBe('llm');
  });

  it('omits internal storage fields like ttl and ingestedAt', () => {
    const card = toCard(post);
    expect(card).not.toHaveProperty('ttl');
    expect(card).not.toHaveProperty('ingestedAt');
    expect(card).not.toHaveProperty('status');
  });

  it('carries an undefined imageUrl through for imageless posts', () => {
    const { imageUrl: _imageUrl, ...withoutImage } = post;
    expect(toCard(withoutImage).imageUrl).toBeUndefined();
  });
});
