import type { Topic } from '@techtok/shared';
import { describe, expect, it } from 'vitest';
import type { PostRecord } from '../posts.types';
import { composeDigestMessage } from './buildDigest';

function post(id: string, cardTitle: string, topic: Topic = 'ai'): PostRecord {
  return {
    postId: id,
    url: `https://example.com/${id}`,
    canonicalUrl: `https://example.com/${id}`,
    sourceId: 'hn',
    sourceName: 'hn',
    origTitle: cardTitle,
    cardTitle,
    summary: cardTitle,
    excerpt: cardTitle,
    primaryTopic: topic,
    topics: [topic],
    status: 'ready',
    transform: 'excerpt',
    publishedAt: '2026-01-01T00:00:00.000Z',
    ingestedAt: '2026-01-01T00:00:00.000Z',
    ttl: 0,
  };
}

describe('composeDigestMessage', () => {
  it('returns null when there are no unread items', () => {
    expect(composeDigestMessage('token-1', [])).toBeNull();
  });

  it('singularizes the title for exactly one unread item', () => {
    const message = composeDigestMessage('token-1', [post('a', 'Cool story')]);
    expect(message).toMatchObject({
      to: 'token-1',
      title: '1 new story waiting',
      body: 'Cool story',
    });
  });

  it('pluralizes and counts for multiple unread items', () => {
    const message = composeDigestMessage('token-1', [post('a', 'First'), post('b', 'Second')]);
    expect(message).toMatchObject({ title: '2 new stories waiting', body: 'First' });
  });
});
