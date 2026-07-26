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
  i18n: {},
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
      isBookmarked: false,
      servedLang: 'en',
      isTranslated: false,
      compactLangs: [],
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

  it('defaults isBookmarked to false and honors an explicit true', () => {
    expect(toCard(post).isBookmarked).toBe(false);
    expect(toCard(post, true).isBookmarked).toBe(true);
  });

  it('prefers the mirrored CDN image url over the original hotlinked one', () => {
    const mirrored: PostRecord = {
      ...post,
      mirroredImageUrl: 'https://cdn.example.com/images/abc123.jpg',
    };
    expect(toCard(mirrored).imageUrl).toBe('https://cdn.example.com/images/abc123.jpg');
  });

  it('falls back to the original imageUrl when no mirror exists', () => {
    expect(toCard(post).imageUrl).toBe('https://example.com/a.jpg');
  });

  it('defaults to english when no lang is given', () => {
    const card = toCard(post);
    expect(card.servedLang).toBe('en');
    expect(card.isTranslated).toBe(false);
  });

  it('serves the translated fields and marks isTranslated when a translation exists', () => {
    const translated: PostRecord = {
      ...post,
      i18n: {
        ru: {
          cardTitle: 'Заголовок',
          summary: 'Содержание.',
          translatedAt: '2026-07-23T00:00:00.000Z',
        },
      },
    };

    const card = toCard(translated, false, 'ru');

    expect(card.title).toBe('Заголовок');
    expect(card.summary).toBe('Содержание.');
    expect(card.servedLang).toBe('ru');
    expect(card.isTranslated).toBe(true);
  });

  it('falls back to english when the requested translation is missing', () => {
    const card = toCard(post, false, 'ru');
    expect(card.title).toBe('Original title');
    expect(card.servedLang).toBe('en');
    expect(card.isTranslated).toBe(false);
  });

  it('carries compactLangs through when the post has cached compact variants', () => {
    const withCompacts: PostRecord = { ...post, compactLangs: ['en', 'ru'] };
    expect(toCard(withCompacts).compactLangs).toEqual(['en', 'ru']);
  });

  it('defaults compactLangs to an empty array for pre-phase-9 posts lacking the field', () => {
    expect(toCard(post).compactLangs).toEqual([]);
  });

  it('omits sourceCount for a post with no recorded duplicates', () => {
    expect(toCard(post).sourceCount).toBeUndefined();
  });

  it('reports sourceCount as dupCount + 1 (the original plus each duplicate)', () => {
    const covered: PostRecord = { ...post, dupCount: 2 };
    expect(toCard(covered).sourceCount).toBe(3);
  });
});
