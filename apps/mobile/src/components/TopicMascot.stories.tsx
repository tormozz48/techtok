import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { View } from 'react-native';
import { TopicMascot } from './TopicMascot';

const meta: Meta<typeof TopicMascot> = {
  title: 'components/TopicMascot',
  component: TopicMascot,
  argTypes: {
    topic: {
      control: 'select',
      options: ['ai', 'dev', 'gadgets', 'startups', 'security', 'science', 'space', 'bio'],
    },
  },
  decorators: [
    (Story) => (
      <View style={{ width: 200, height: 220, backgroundColor: '#0F2027' }}>
        <Story />
      </View>
    ),
  ],
};

export default meta;

type Story = StoryObj<typeof TopicMascot>;

export const Ai: Story = {
  args: { topic: 'ai', opacity: 1 },
};

export const Dev: Story = {
  args: { topic: 'dev', opacity: 1 },
};

export const Gadgets: Story = {
  args: { topic: 'gadgets', opacity: 1 },
};

export const Startups: Story = {
  args: { topic: 'startups', opacity: 1 },
};

export const Security: Story = {
  args: { topic: 'security', opacity: 1 },
};

export const Science: Story = {
  args: { topic: 'science', opacity: 1 },
};

export const Space: Story = {
  args: { topic: 'space', opacity: 1 },
};

export const Bio: Story = {
  args: { topic: 'bio', opacity: 1 },
};
