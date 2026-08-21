import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import OnboardingScreen from '@/app/onboarding';

const meta: Meta<typeof OnboardingScreen> = {
  title: 'pages/OnboardingScreen',
  component: OnboardingScreen,
};

export default meta;

type Story = StoryObj<typeof OnboardingScreen>;

export const Default: Story = {};
