import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import type { EntitlementResponse, SourcesResponse } from '@techtok/shared';
import type { ReactElement } from 'react';
import SettingsScreen from '@/app/settings';
import { useHapticsStore } from '@/state/hapticsStore';
import { useMutedSourcesStore } from '@/state/mutedSourcesStore';
import { withSeededQueries } from '../withSeededQuery';

const SOURCES: SourcesResponse = {
  sources: [
    { sourceId: 'techcrunch', name: 'TechCrunch', plusOnly: false },
    { sourceId: 'the-verge', name: 'The Verge', plusOnly: false },
    { sourceId: 'ars-technica', name: 'Ars Technica', plusOnly: true },
    { sourceId: 'hacker-news', name: 'Hacker News', plusOnly: true },
  ],
};

const FREE_ENTITLEMENT: EntitlementResponse = {
  plan: 'free',
  quota: {
    cardReads: 12,
    cardReadsLimit: 30,
    readerOpens: 3,
    readerOpensLimit: 10,
    resetsAt: new Date(Date.now() + 8 * 3_600_000).toISOString(),
  },
};

const PLUS_ENTITLEMENT: EntitlementResponse = {
  plan: 'plus',
  quota: {
    cardReads: 12,
    cardReadsLimit: 30,
    readerOpens: 3,
    readerOpensLimit: 10,
    resetsAt: new Date(Date.now() + 8 * 3_600_000).toISOString(),
  },
};

const SEEDS = [
  { queryKey: ['sources'], data: SOURCES },
  { queryKey: ['entitlement'], data: FREE_ENTITLEMENT },
];

const PLUS_SEEDS = [
  { queryKey: ['sources'], data: SOURCES },
  { queryKey: ['entitlement'], data: PLUS_ENTITLEMENT },
];

function withHaptics(enabled: boolean) {
  return (Story: () => ReactElement) => {
    useHapticsStore.setState({ enabled });
    return <Story />;
  };
}

function withMutedSources(mutedSources: string[]) {
  return (Story: () => ReactElement) => {
    useMutedSourcesStore.setState({ mutedSources });
    return <Story />;
  };
}

const meta: Meta<typeof SettingsScreen> = {
  title: 'pages/SettingsScreen',
  component: SettingsScreen,
};

export default meta;

type Story = StoryObj<typeof SettingsScreen>;

export const Default: Story = {
  decorators: [withSeededQueries(SEEDS), withHaptics(true)],
};

export const VibrationOff: Story = {
  decorators: [withSeededQueries(SEEDS), withHaptics(false)],
};

export const WithMutedSource: Story = {
  decorators: [withSeededQueries(SEEDS), withHaptics(true), withMutedSources(['the-verge'])],
};

export const WithPlusOnlySources: Story = {
  decorators: [withSeededQueries(SEEDS), withHaptics(true)],
};

export const PlusUserSeesAllSourcesUnlocked: Story = {
  decorators: [withSeededQueries(PLUS_SEEDS), withHaptics(true)],
};
