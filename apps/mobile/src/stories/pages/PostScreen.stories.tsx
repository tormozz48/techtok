import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import type { ContentResponse } from '@techtok/shared';
import PostScreen from '@/app/post/[id]';
import { withSeededQuery } from '../withSeededQuery';

// useLocalSearchParams is mocked to always return {} (see
// .storybook/mocks/expo-router.tsx), so `id` is undefined and the default
// language is 'en' (no cached override in this environment) — the query key
// below must match exactly what the screen will actually request.
const CONTENT: ContentResponse = {
  available: true,
  lang: 'en',
  blocks: [
    { type: 'heading', text: 'A New Model That Actually Fits on a Phone' },
    {
      type: 'paragraph',
      text: 'A new distillation technique cuts model size by 80% while keeping most of the benchmark accuracy, opening the door to fully on-device assistants.',
    },
    { type: 'image', figureIndex: 0, caption: 'The new model running entirely on-device.' },
    {
      type: 'quote',
      text: 'This is the biggest step toward on-device AI we have seen in years.',
    },
    {
      type: 'list',
      items: ['80% smaller footprint', 'No round-trip to a server', 'Works fully offline'],
    },
  ],
  figures: [{ url: 'https://picsum.photos/seed/techtok-reader/800/450' }],
};

const meta: Meta<typeof PostScreen> = {
  title: 'pages/PostScreen',
  component: PostScreen,
};

export default meta;

type Story = StoryObj<typeof PostScreen>;

export const Populated: Story = {
  decorators: [withSeededQuery(['content', undefined, 'en'], CONTENT)],
};
