import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import type { BookmarkItem, BookmarksResponse } from '@techtok/shared';
import SavedScreen from '@/app/saved';
import { withSeededQuery } from '../withSeededQuery';

const SOURCES = ['TechCrunch', 'The Verge', 'Ars Technica'];
const TOPICS: BookmarkItem['primaryTopic'][] = ['ai', 'dev', 'science', 'gadgets'];

function buildItems(count: number): BookmarkItem[] {
  return Array.from({ length: count }, (_, i) => ({
    postId: `story-post-${i}`,
    bookmarkedAt: new Date(Date.now() - i * 3_600_000).toISOString(),
    cardTitle: `Sample article headline number ${i + 1}`,
    sourceName: SOURCES[i % SOURCES.length],
    url: 'https://example.com/article',
    primaryTopic: TOPICS[i % TOPICS.length],
  }));
}

function infinitePage(response: BookmarksResponse) {
  return { pages: [response], pageParams: [undefined] };
}

const meta: Meta<typeof SavedScreen> = {
  title: 'pages/SavedScreen',
  component: SavedScreen,
};

export default meta;

type Story = StoryObj<typeof SavedScreen>;

export const Populated: Story = {
  decorators: [
    withSeededQuery(['bookmarks', ''], infinitePage({ items: buildItems(8), nextCursor: null })),
  ],
};

export const Empty: Story = {
  decorators: [withSeededQuery(['bookmarks', ''], infinitePage({ items: [], nextCursor: null }))],
};
