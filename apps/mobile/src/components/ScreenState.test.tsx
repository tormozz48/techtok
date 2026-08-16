import { fireEvent, render, screen } from '@testing-library/react-native';
import { ScreenState } from './ScreenState';

describe('ScreenState', () => {
  it('renders a spinner when loading', async () => {
    await render(<ScreenState loading caption="Loading…" />);
    expect(screen.getByText('Loading…')).toBeTruthy();
  });

  it('renders a message with no retry button', async () => {
    await render(<ScreenState message="Nothing here." />);
    expect(screen.getByText('Nothing here.')).toBeTruthy();
    expect(screen.queryByText('Retry')).toBeNull();
  });

  it('renders a retry button and calls onRetry when pressed', async () => {
    const onRetry = jest.fn();
    await render(<ScreenState message="Failed." retryLabel="Retry" onRetry={onRetry} />);
    await fireEvent.press(screen.getByText('Retry'));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
