import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import type { Card as CardData } from '@techtok/shared';
import { View } from 'react-native';
import { FeedPager } from './FeedPager';

const BASE_CARD: CardData = {
  id: 'story-post-1',
  title: 'Researchers Ship a New Model That Actually Fits on a Phone',
  summary:
    'A new distillation technique cuts model size by 80% while keeping most of the benchmark accuracy, opening the door to fully on-device assistants.',
  whyItMatters: 'On-device inference means no round-trip to a server — and no server bill.',
  sourceName: 'TechCrunch',
  url: 'https://example.com/article',
  primaryTopic: 'ai',
  topics: ['ai', 'dev'],
  publishedAt: '2026-07-20T12:00:00.000Z',
  servedLang: 'en',
  isTranslated: false,
  compactLangs: [],
};

function buildCards(count: number): CardData[] {
  return Array.from({ length: count }, (_, i) => ({
    ...BASE_CARD,
    id: `story-post-${i + 1}`,
    title: `${BASE_CARD.title} (${i + 1}/${count})`,
    imageUrl: i % 2 === 0 ? `https://picsum.photos/seed/techtok-${i}/800/1200` : undefined,
  }));
}

const meta: Meta<typeof FeedPager> = {
  title: 'components/FeedPager',
  component: FeedPager,
  args: {
    onPageChange: (card) => console.log('[storybook] page changed ->', card.id),
    onNearEnd: () => console.log('[storybook] near end of feed'),
  },
  decorators: [
    (Story) => (
      <View style={{ width: 360, height: 640 }}>
        <Story />
      </View>
    ),
  ],
};

export default meta;

type Story = StoryObj<typeof FeedPager>;

export const Default: Story = {
  args: { cards: buildCards(6) },
};
