import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import type { HistoryItem } from '@techtok/shared';
import StatsScreen from '@/app/stats';
import { ONE_DAY_MS } from '@/constants/time';
import { withSeededQuery } from '../withSeededQuery';

function daysAgo(days: number): string {
  return new Date(Date.now() - days * ONE_DAY_MS).toISOString();
}

const SOURCES = ['TechCrunch', 'The Verge', 'Ars Technica'];
const TOPICS: HistoryItem['primaryTopic'][] = ['ai', 'dev', 'science', 'ai', 'space'];

function buildHistory(days: number): HistoryItem[] {
  return Array.from({ length: days }, (_, i) => ({
    postId: `story-post-${i}`,
    readAt: daysAgo(i),
    cardTitle: `Sample article #${i + 1}`,
    sourceName: SOURCES[i % SOURCES.length],
    url: 'https://example.com/article',
    primaryTopic: TOPICS[i % TOPICS.length],
  }));
}

const meta: Meta<typeof StatsScreen> = {
  title: 'pages/StatsScreen',
  component: StatsScreen,
};

export default meta;

type Story = StoryObj<typeof StatsScreen>;

export const Populated: Story = {
  decorators: [withSeededQuery(['stats-history'], buildHistory(45))],
};

export const Empty: Story = {
  decorators: [withSeededQuery(['stats-history'], [])],
};
