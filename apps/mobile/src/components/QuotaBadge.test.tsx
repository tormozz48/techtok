import { render, screen } from '@testing-library/react-native';
import { QuotaBadge } from './QuotaBadge';

describe('QuotaBadge', () => {
  it('renders both counters as compact used/limit pairs', async () => {
    await render(
      <QuotaBadge cardReads={12} cardReadsLimit={30} readerOpens={3} readerOpensLimit={10} />,
    );
    expect(screen.getByText('12/30')).toBeTruthy();
    expect(screen.getByText('3/10')).toBeTruthy();
  });

  it('keeps the counter meanings in accessibility labels, not on screen', async () => {
    await render(
      <QuotaBadge cardReads={12} cardReadsLimit={30} readerOpens={3} readerOpensLimit={10} />,
    );
    expect(screen.getByLabelText('Cards today: 12/30')).toBeTruthy();
    expect(screen.getByLabelText('Articles today: 3/10')).toBeTruthy();
    expect(screen.queryByText(/Cards today/)).toBeNull();
    expect(screen.queryByText(/Articles today/)).toBeNull();
  });
});
