import { render, screen } from '@testing-library/react-native';
import { QuotaBadge } from './QuotaBadge';

describe('QuotaBadge', () => {
  it('renders the used/limit counts', async () => {
    await render(<QuotaBadge used={12} limit={50} />);
    expect(screen.getByText('12 / 50')).toBeTruthy();
  });
});
