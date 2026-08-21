import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { BuildInfo } from './BuildInfo';

const meta: Meta<typeof BuildInfo> = {
  title: 'components/BuildInfo',
  component: BuildInfo,
};

export default meta;

type Story = StoryObj<typeof BuildInfo>;

export const OverTheAirUpdate: Story = {
  args: {
    value: {
      source: 'ota',
      bundleVersion: '0.23.1',
      runtimeVersion: '1.0.0',
      channel: 'preview',
      updateId: 'a1b2c3d4',
      publishedAt: '2026-08-21 09:42',
    },
  },
};

export const EmbeddedBundle: Story = {
  args: {
    value: {
      source: 'embedded',
      bundleVersion: '0.23.0',
      runtimeVersion: '1.0.0',
      channel: 'preview',
      updateId: '—',
      publishedAt: '—',
    },
  },
};

export const ExpoGo: Story = {
  args: {
    value: {
      source: 'embedded',
      bundleVersion: '0.23.1',
      runtimeVersion: '—',
      channel: '—',
      updateId: '—',
      publishedAt: '—',
    },
  },
};
