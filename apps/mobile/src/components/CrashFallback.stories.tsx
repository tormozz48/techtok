import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { CrashFallback } from './CrashFallback';

const meta: Meta<typeof CrashFallback> = {
  title: 'components/CrashFallback',
  component: CrashFallback,
  args: {
    resetError: () => {},
  },
};

export default meta;

type Story = StoryObj<typeof CrashFallback>;

export const Default: Story = {};
