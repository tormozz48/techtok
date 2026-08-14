import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import type { EntitlementResponse } from '@techtok/shared';
import PaywallScreen from '@/app/paywall';
import { withSeededQuery } from '../withSeededQuery';

const AVAILABLE: EntitlementResponse = {
  plan: 'free',
  quota: {
    cardReads: 12,
    cardReadsLimit: 100,
    readerOpens: 3,
    readerOpensLimit: 20,
    resetsAt: new Date(Date.now() + 8 * 3_600_000).toISOString(),
  },
};

const EXHAUSTED: EntitlementResponse = {
  plan: 'free',
  quota: {
    cardReads: 100,
    cardReadsLimit: 100,
    readerOpens: 4,
    readerOpensLimit: 20,
    resetsAt: new Date(Date.now() + 3 * 3_600_000).toISOString(),
  },
};

const meta: Meta<typeof PaywallScreen> = {
  title: 'pages/PaywallScreen',
  component: PaywallScreen,
};

export default meta;

type Story = StoryObj<typeof PaywallScreen>;

export const Default: Story = {
  decorators: [withSeededQuery(['entitlement'], AVAILABLE)],
};

export const QuotaExhausted: Story = {
  decorators: [withSeededQuery(['entitlement'], EXHAUSTED)],
};
