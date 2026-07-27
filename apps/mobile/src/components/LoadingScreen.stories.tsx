import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { LoadingScreen } from './LoadingScreen';

const meta: Meta<typeof LoadingScreen> = {
  title: 'components/LoadingScreen',
  component: LoadingScreen,
};

export default meta;

type Story = StoryObj<typeof LoadingScreen>;

export const Default: Story = {};
