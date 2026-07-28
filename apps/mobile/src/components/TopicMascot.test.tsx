import type { Topic } from '@techtok/shared';
import { act, create } from 'react-test-renderer';
import { TopicMascot } from './TopicMascot';

const TOPICS: Topic[] = ['ai', 'dev', 'gadgets', 'startups', 'security', 'science', 'space', 'bio'];

function renderMascot(topic: Topic) {
  let tree: ReturnType<typeof create> | undefined;
  act(() => {
    tree = create(<TopicMascot topic={topic} />);
  });
  if (!tree) throw new Error('renderer.create did not produce a tree');
  return tree.toJSON();
}

describe('TopicMascot', () => {
  it.each(TOPICS)('renders %s without crashing', (topic) => {
    expect(renderMascot(topic)).toBeTruthy();
  });
});
