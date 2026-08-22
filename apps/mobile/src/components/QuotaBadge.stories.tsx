import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { View } from 'react-native';
import { QuotaBadge } from './QuotaBadge';

const meta: Meta<typeof QuotaBadge> = {
  title: 'components/QuotaBadge',
  component: QuotaBadge,
  decorators: [
    (Story) => (
      <View style={{ backgroundColor: '#000000', padding: 24 }}>
        <Story />
      </View>
    ),
  ],
};

export default meta;

type Story = StoryObj<typeof QuotaBadge>;

export const Default: Story = {
  args: { used: 12, limit: 50 },
};

export const NearLimit: Story = {
  args: { used: 47, limit: 50 },
};

export const Labeled: Story = {
  args: { used: 18, limit: 20, label: 'Articles today' },
};
