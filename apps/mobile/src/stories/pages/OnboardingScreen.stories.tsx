import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import OnboardingScreen from '@/app/onboarding';

// load()/loadLanguage() fire on mount and hit fetchMe(), which rejects in
// the Storybook/Vite environment (no EXPO_PUBLIC_API_URL) — same expected
// rejection noted in BookmarkButton.stories.tsx. The screen falls back to
// its cached defaults (no topics selected, language 'en'), which is exactly
// the first-run state this screen exists to show.
const meta: Meta<typeof OnboardingScreen> = {
  title: 'pages/OnboardingScreen',
  component: OnboardingScreen,
};

export default meta;

type Story = StoryObj<typeof OnboardingScreen>;

export const Default: Story = {};
