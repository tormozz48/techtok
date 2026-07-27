import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import type { HistoryItem, HistoryResponse } from '@techtok/shared';
import HistoryScreen from '@/app/history';
import { withSeededQuery } from '../withSeededQuery';

const SOURCES = ['TechCrunch', 'The Verge', 'Ars Technica'];
const TOPICS: HistoryItem['primaryTopic'][] = ['ai', 'dev', 'science', 'gadgets'];

function buildItems(count: number): HistoryItem[] {
  return Array.from({ length: count }, (_, i) => ({
    postId: `story-post-${i}`,
    readAt: new Date(Date.now() - i * 3_600_000).toISOString(),
    cardTitle: `Sample article headline number ${i + 1}`,
    sourceName: SOURCES[i % SOURCES.length],
    url: 'https://example.com/article',
    primaryTopic: TOPICS[i % TOPICS.length],
  }));
}

function infinitePage(response: HistoryResponse) {
  return { pages: [response], pageParams: [undefined] };
}

const meta: Meta<typeof HistoryScreen> = {
  title: 'pages/HistoryScreen',
  component: HistoryScreen,
};

export default meta;

type Story = StoryObj<typeof HistoryScreen>;

export const Populated: Story = {
  decorators: [
    withSeededQuery(['history', ''], infinitePage({ items: buildItems(12), nextCursor: null })),
  ],
};

export const Empty: Story = {
  decorators: [withSeededQuery(['history', ''], infinitePage({ items: [], nextCursor: null }))],
};
