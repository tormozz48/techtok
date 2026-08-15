import { LANGUAGE_LABELS } from '@techtok/shared';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { LanguagePicker } from './LanguagePicker';

describe('LanguagePicker', () => {
  it('calls onChange with the pressed language', async () => {
    const onChange = jest.fn();
    await render(<LanguagePicker language="en" onChange={onChange} />);
    await fireEvent.press(screen.getByLabelText(LANGUAGE_LABELS.uk));
    expect(onChange).toHaveBeenCalledWith('uk');
  });

  it('does not call onChange when disabled', async () => {
    const onChange = jest.fn();
    await render(<LanguagePicker language="en" onChange={onChange} disabled />);
    await fireEvent.press(screen.getByLabelText(LANGUAGE_LABELS.uk));
    expect(onChange).not.toHaveBeenCalled();
  });
});
