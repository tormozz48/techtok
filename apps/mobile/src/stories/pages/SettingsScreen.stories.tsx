import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import type { SourcesResponse } from '@techtok/shared';
import SettingsScreen from '@/app/settings';
import { withSeededQuery } from '../withSeededQuery';

const SOURCES: SourcesResponse = {
  sources: [
    { sourceId: 'techcrunch', name: 'TechCrunch' },
    { sourceId: 'the-verge', name: 'The Verge' },
    { sourceId: 'ars-technica', name: 'Ars Technica' },
    { sourceId: 'hacker-news', name: 'Hacker News' },
  ],
};

const meta: Meta<typeof SettingsScreen> = {
  title: 'pages/SettingsScreen',
  component: SettingsScreen,
};

export default meta;

type Story = StoryObj<typeof SettingsScreen>;

export const Default: Story = {
  decorators: [withSeededQuery(['sources'], SOURCES)],
};
