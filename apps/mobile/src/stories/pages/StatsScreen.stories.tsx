import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import type { HistoryItem } from '@techtok/shared';
import StatsScreen from '@/app/stats';
import { withSeededQuery } from '../withSeededQuery';

const DAY_MS = 24 * 60 * 60 * 1000;

function daysAgo(days: number): string {
  return new Date(Date.now() - days * DAY_MS).toISOString();
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
