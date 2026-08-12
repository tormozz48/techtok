import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import AuthScreen from '@/app/auth';

// signIn() calls GoogleOneTapSignIn.configure()/presentExplicitSignIn(), which
// reject in the Storybook/Vite environment (no native module, no EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID)
// — same expected-rejection shape as OnboardingScreen.stories.tsx's
// fetchMe() note. The screen's own catch block renders the error state,
// which this story exists to show.
const meta: Meta<typeof AuthScreen> = {
  title: 'pages/AuthScreen',
  component: AuthScreen,
};

export default meta;

type Story = StoryObj<typeof AuthScreen>;

export const Default: Story = {};
