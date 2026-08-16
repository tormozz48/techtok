import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import type { Card as CardData, EntitlementResponse, FeedResponse } from '@techtok/shared';
import FeedScreen from '@/app/index';
import { withSeededQueries } from '../withSeededQuery';

const FREE_ENTITLEMENT: EntitlementResponse = {
  plan: 'free',
  quota: {
    cardReads: 12,
    cardReadsLimit: 100,
    readerOpens: 3,
    readerOpensLimit: 20,
    resetsAt: new Date(Date.now() + 8 * 3_600_000).toISOString(),
  },
};

const SOURCES = ['TechCrunch', 'The Verge', 'Ars Technica'];
const TOPICS: CardData['primaryTopic'][] = ['ai', 'dev', 'science', 'gadgets'];

function buildCards(count: number): CardData[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `story-post-${i}`,
    title: `Sample article headline number ${i + 1}`,
    summary: 'A short two-sentence summary of the article, condensed for the feed card.',
    whyItMatters: 'A one-line reason this story is worth a swipe.',
    imageUrl: i % 2 === 0 ? `https://picsum.photos/seed/techtok-feed-${i}/800/1200` : undefined,
    sourceName: SOURCES[i % SOURCES.length],
    url: 'https://example.com/article',
    primaryTopic: TOPICS[i % TOPICS.length],
    topics: [TOPICS[i % TOPICS.length]],
    publishedAt: new Date(Date.now() - i * 3_600_000).toISOString(),
    servedLang: 'en',
    isTranslated: false,
    compactLangs: [],
  }));
}

function infinitePage(response: FeedResponse) {
  return { pages: [response], pageParams: [undefined] };
}

const meta: Meta<typeof FeedScreen> = {
  title: 'pages/FeedScreen',
  component: FeedScreen,
};

export default meta;

type Story = StoryObj<typeof FeedScreen>;

export const Populated: Story = {
  decorators: [
    withSeededQueries([
      { queryKey: ['feed', 'en'], data: infinitePage({ items: buildCards(6), nextBefore: null }) },
      { queryKey: ['entitlement'], data: FREE_ENTITLEMENT },
    ]),
  ],
};

export const Empty: Story = {
  decorators: [
    withSeededQueries([
      { queryKey: ['feed', 'en'], data: infinitePage({ items: [], nextBefore: null }) },
      { queryKey: ['entitlement'], data: FREE_ENTITLEMENT },
    ]),
  ],
};
