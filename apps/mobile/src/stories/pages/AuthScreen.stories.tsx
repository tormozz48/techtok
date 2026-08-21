import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import AuthScreen from '@/app/auth';

const meta: Meta<typeof AuthScreen> = {
  title: 'pages/AuthScreen',
  component: AuthScreen,
};

export default meta;

type Story = StoryObj<typeof AuthScreen>;

export const Default: Story = {};
