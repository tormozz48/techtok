import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import AccountScreen from '@/app/account';
import { useAuthStore } from '@/state/authStore';

useAuthStore.setState({
  status: 'signedIn',
  user: { idToken: 'story-token', email: 'ada@example.com', name: 'Ada Lovelace' },
});

const meta: Meta<typeof AccountScreen> = {
  title: 'pages/AccountScreen',
  component: AccountScreen,
};

export default meta;

type Story = StoryObj<typeof AccountScreen>;

export const Default: Story = {};
