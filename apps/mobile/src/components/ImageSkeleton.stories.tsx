import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { View } from 'react-native';
import { ImageSkeleton } from './ImageSkeleton';

const meta: Meta<typeof ImageSkeleton> = {
  title: 'components/ImageSkeleton',
  component: ImageSkeleton,
  decorators: [
    (Story) => (
      <View style={{ width: 320, height: 200 }}>
        <Story />
      </View>
    ),
  ],
};

export default meta;

type Story = StoryObj<typeof ImageSkeleton>;

export const Default: Story = {};
