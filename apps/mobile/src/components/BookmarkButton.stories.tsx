import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { View } from 'react-native';
import { BookmarkButton } from './BookmarkButton';

const meta: Meta<typeof BookmarkButton> = {
  title: 'components/BookmarkButton',
  component: BookmarkButton,
  args: {
    postId: 'story-post-1',
  },
  decorators: [
    (Story) => (
      <View style={{ backgroundColor: '#111A33', padding: 8 }}>
        <Story />
      </View>
    ),
  ],
};

export default meta;

type Story = StoryObj<typeof BookmarkButton>;

export const Unbookmarked: Story = {
  args: { isBookmarked: false },
};

export const Bookmarked: Story = {
  args: { isBookmarked: true },
};
