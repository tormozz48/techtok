import { fireEvent, render, screen } from '@testing-library/react-native';
import { SelectableList, type SelectableListProps } from './SelectableList';

const ITEMS = ['ai', 'space', 'dev'] as const;
type Topic = (typeof ITEMS)[number];

async function renderList(overrides: Partial<SelectableListProps<Topic>> = {}) {
  const onSelect = jest.fn();
  await render(
    <SelectableList
      items={ITEMS}
      isSelected={(topic) => topic === 'ai'}
      label={(topic) => topic}
      onSelect={onSelect}
      rowStyle={undefined}
      rowSelectedStyle={undefined}
      rowTextStyle={undefined}
      checkIconColor="#000"
      {...overrides}
    />,
  );
  return { onSelect };
}

describe('SelectableList', () => {
  it('renders a row per item with its label', async () => {
    await renderList();
    for (const topic of ITEMS) {
      expect(screen.getByText(topic)).toBeTruthy();
    }
  });

  it('calls onSelect with the pressed item', async () => {
    const { onSelect } = await renderList();
    await fireEvent.press(screen.getByText('space'));
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith('space');
  });

  it('does not call onSelect when disabled', async () => {
    const { onSelect } = await renderList({ disabled: true });
    await fireEvent.press(screen.getByText('space'));
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('calls onLockedPress instead of onSelect for a locked item', async () => {
    const onSelect = jest.fn();
    const onLockedPress = jest.fn();
    await renderList({
      onSelect,
      isLocked: (topic) => topic === 'space',
      onLockedPress,
    });

    await fireEvent.press(screen.getByText('space'));

    expect(onLockedPress).toHaveBeenCalledWith('space');
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('exposes the locked accessibility label for a locked item', async () => {
    await renderList({
      isLocked: (topic) => topic === 'space',
      lockedAccessibilityLabel: (topic) => `${topic} is locked`,
    });

    expect(screen.getByLabelText('space is locked')).toBeTruthy();
  });
});
