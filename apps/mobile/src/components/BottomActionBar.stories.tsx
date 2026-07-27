import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import type { Card as CardData } from '@techtok/shared';
import { View } from 'react-native';
import { BottomActionBar } from './BottomActionBar';

const SAMPLE_CARD: CardData = {
  id: 'story-post-1',
  title: 'Researchers Ship a New Model That Actually Fits on a Phone',
  summary: 'A new distillation technique cuts model size by 80%.',
  sourceName: 'TechCrunch',
  url: 'https://example.com/article',
  primaryTopic: 'ai',
  topics: ['ai'],
  publishedAt: '2026-07-20T12:00:00.000Z',
  servedLang: 'en',
  isTranslated: false,
  compactLangs: [],
};

const meta: Meta<typeof BottomActionBar> = {
  title: 'components/BottomActionBar',
  component: BottomActionBar,
  args: {
    onRefresh: () => console.log('[storybook] refresh pressed'),
  },
  decorators: [
    (Story) => (
      <View style={{ backgroundColor: '#111A33' }}>
        <Story />
      </View>
    ),
  ],
};

export default meta;

type Story = StoryObj<typeof BottomActionBar>;

export const WithActiveCard: Story = {
  args: { activeCard: SAMPLE_CARD },
};

export const NoActiveCard: Story = {
  args: { activeCard: undefined },
};
