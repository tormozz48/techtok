import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { ScreenState } from './ScreenState';

const meta: Meta<typeof ScreenState> = {
  title: 'components/ScreenState',
  component: ScreenState,
};

export default meta;

type Story = StoryObj<typeof ScreenState>;

export const Loading: Story = {
  args: { loading: true, caption: 'Loading article…' },
};

export const Empty: Story = {
  args: { message: 'Nothing here yet.' },
};

export const ErrorWithRetry: Story = {
  args: {
    message: 'Something went wrong.',
    retryLabel: 'Retry',
    onRetry: () => {},
  },
};
