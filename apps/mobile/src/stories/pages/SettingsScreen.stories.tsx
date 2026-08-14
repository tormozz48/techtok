import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import type { EntitlementResponse, SourcesResponse } from '@techtok/shared';
import SettingsScreen from '@/app/settings';
import { withSeededQueries } from '../withSeededQuery';

const SOURCES: SourcesResponse = {
  sources: [
    { sourceId: 'techcrunch', name: 'TechCrunch' },
    { sourceId: 'the-verge', name: 'The Verge' },
    { sourceId: 'ars-technica', name: 'Ars Technica' },
    { sourceId: 'hacker-news', name: 'Hacker News' },
  ],
};

const ENTITLEMENT: EntitlementResponse = {
  plan: 'free',
  quota: {
    cardReads: 12,
    cardReadsLimit: 100,
    readerOpens: 3,
    readerOpensLimit: 20,
    resetsAt: new Date(Date.now() + 8 * 3_600_000).toISOString(),
  },
};

const meta: Meta<typeof SettingsScreen> = {
  title: 'pages/SettingsScreen',
  component: SettingsScreen,
};

export default meta;

type Story = StoryObj<typeof SettingsScreen>;

export const Default: Story = {
  decorators: [
    withSeededQueries([
      { queryKey: ['sources'], data: SOURCES },
      { queryKey: ['entitlement'], data: ENTITLEMENT },
    ]),
  ],
};
