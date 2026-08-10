import { fireEvent, render, screen } from '@testing-library/react-native';
import { LanguageFlagRow, type LanguageFlagRowProps } from './LanguageFlagRow';

const LANGUAGES = ['en', 'ru', 'uk'] as const;
type Language = (typeof LANGUAGES)[number];

async function renderRow(overrides: Partial<LanguageFlagRowProps<Language>> = {}) {
  const onSelect = jest.fn();
  await render(
    <LanguageFlagRow
      items={LANGUAGES}
      isSelected={(lang) => lang === 'en'}
      flag={(lang) => lang}
      accessibilityLabel={(lang) => `lang-${lang}`}
      onSelect={onSelect}
      buttonStyle={undefined}
      buttonSelectedStyle={undefined}
      {...overrides}
    />,
  );
  return { onSelect };
}

describe('LanguageFlagRow', () => {
  it('renders a button per item with the right accessibility label', async () => {
    await renderRow();
    for (const lang of LANGUAGES) {
      expect(screen.getByLabelText(`lang-${lang}`)).toBeTruthy();
    }
  });

  it('calls onSelect with the pressed item', async () => {
    const { onSelect } = await renderRow();
    await fireEvent.press(screen.getByLabelText('lang-ru'));
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith('ru');
  });

  it('marks the selected item via accessibilityState', async () => {
    await renderRow();
    expect(screen.getByLabelText('lang-en').props.accessibilityState).toMatchObject({
      selected: true,
    });
    expect(screen.getByLabelText('lang-ru').props.accessibilityState).toMatchObject({
      selected: false,
    });
  });

  it('does not call onSelect when disabled', async () => {
    const { onSelect } = await renderRow({ disabled: true });
    await fireEvent.press(screen.getByLabelText('lang-ru'));
    expect(onSelect).not.toHaveBeenCalled();
  });
});
