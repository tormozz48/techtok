import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import type { Card as CardData } from '@techtok/shared';
import { View } from 'react-native';
import { Card } from './Card';

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

const meta: Meta<typeof Card> = {
  title: 'components/Card',
  component: Card,
  decorators: [
    (Story) => (
      <View style={{ width: 360, height: 640 }}>
        <Story />
      </View>
    ),
  ],
};

export default meta;

type Story = StoryObj<typeof Card>;

export const NoImage: Story = {
  args: { card: BASE_CARD },
};

export const WithImage: Story = {
  args: {
    card: {
      ...BASE_CARD,
      id: 'story-post-2',
      imageUrl: 'https://picsum.photos/seed/techtok/800/1200',
    },
  },
};

export const Translated: Story = {
  args: {
    card: {
      ...BASE_CARD,
      id: 'story-post-3',
      isTranslated: true,
      servedLang: 'ru',
    },
  },
};

export const CoveredBySources: Story = {
  args: {
    card: {
      ...BASE_CARD,
      id: 'story-post-4',
      sourceCount: 3,
    },
  },
};
