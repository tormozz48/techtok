import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import type { Language } from '@techtok/shared';
import { useState } from 'react';
import { LanguagePicker } from './LanguagePicker';

function StatefulLanguagePicker() {
  const [language, setLanguage] = useState<Language>('en');
  return <LanguagePicker language={language} onChange={setLanguage} />;
}

const meta: Meta<typeof StatefulLanguagePicker> = {
  title: 'components/LanguagePicker',
  component: StatefulLanguagePicker,
};

export default meta;

type Story = StoryObj<typeof StatefulLanguagePicker>;

export const Default: Story = {};
