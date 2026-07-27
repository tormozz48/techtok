import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { View } from 'react-native';
import { BookmarkButton } from './BookmarkButton';

// EXPO_PUBLIC_API_URL isn't set in the Storybook/Vite environment, so a
// toggle here optimistically flips then reverts once the API call rejects —
// expected in isolation, not a bug in this story.
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
