import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { View } from 'react-native';
import { ImageStub } from './ImageStub';

const meta: Meta<typeof ImageStub> = {
  title: 'components/ImageStub',
  component: ImageStub,
  argTypes: {
    topic: {
      control: 'select',
      options: ['ai', 'dev', 'gadgets', 'startups', 'security', 'science', 'space', 'bio'],
    },
  },
  decorators: [
    (Story) => (
      <View style={{ width: 320, height: 200 }}>
        <Story />
      </View>
    ),
  ],
};

export default meta;

type Story = StoryObj<typeof ImageStub>;

export const Default: Story = {
  args: { postId: 'story-post-1', topic: 'ai' },
};

export const Science: Story = {
  args: { postId: 'story-post-2', topic: 'science' },
};
