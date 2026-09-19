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
  args: { cardReads: 12, cardReadsLimit: 30, readerOpens: 3, readerOpensLimit: 10 },
};

export const NearLimit: Story = {
  args: { cardReads: 29, cardReadsLimit: 30, readerOpens: 9, readerOpensLimit: 10 },
};
