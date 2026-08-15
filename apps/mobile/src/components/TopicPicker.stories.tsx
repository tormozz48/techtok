import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import type { Topic } from '@techtok/shared';
import { useState } from 'react';
import { TopicPicker } from './TopicPicker';

function StatefulTopicPicker() {
  const [topics, setTopics] = useState<Topic[]>(['ai', 'science']);

  return (
    <TopicPicker
      topics={topics}
      language="en"
      hintAll="Showing all topics."
      hintSome={(selected, total) => `Showing ${selected} of ${total} topics.`}
      onChange={setTopics}
    />
  );
}

const meta: Meta<typeof StatefulTopicPicker> = {
  title: 'components/TopicPicker',
  component: StatefulTopicPicker,
};

export default meta;

type Story = StoryObj<typeof StatefulTopicPicker>;

export const Default: Story = {};
