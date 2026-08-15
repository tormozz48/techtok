import { getTopicLabel, TOPICS } from '@techtok/shared';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { TopicPicker, type TopicPickerProps } from './TopicPicker';

async function renderPicker(overrides: Partial<TopicPickerProps> = {}) {
  const onChange = jest.fn();
  await render(
    <TopicPicker
      topics={['ai']}
      language="en"
      hintAll="Showing all topics."
      hintSome={(selected, total) => `Showing ${selected} of ${total} topics.`}
      onChange={onChange}
      {...overrides}
    />,
  );
  return { onChange };
}

describe('TopicPicker', () => {
  it('shows the "some selected" hint when topics are selected', async () => {
    await renderPicker({ topics: ['ai'] });
    expect(screen.getByText(`Showing 1 of ${TOPICS.length} topics.`)).toBeTruthy();
  });

  it('shows the "all" hint when no topics are selected', async () => {
    await renderPicker({ topics: [] });
    expect(screen.getByText('Showing all topics.')).toBeTruthy();
  });

  it('adds an unselected topic to the selection on toggle', async () => {
    const { onChange } = await renderPicker({ topics: ['ai'] });
    await fireEvent.press(screen.getByText(getTopicLabel('space', 'en')));
    expect(onChange).toHaveBeenCalledWith(['ai', 'space']);
  });

  it('removes a selected topic from the selection on toggle', async () => {
    const { onChange } = await renderPicker({ topics: ['ai', 'space'] });
    await fireEvent.press(screen.getByText(getTopicLabel('ai', 'en')));
    expect(onChange).toHaveBeenCalledWith(['space']);
  });
});
