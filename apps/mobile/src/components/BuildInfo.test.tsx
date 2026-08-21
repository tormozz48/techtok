import { render, screen } from '@testing-library/react-native';
import { BuildInfo } from './BuildInfo';

const OTA = {
  source: 'ota' as const,
  bundleVersion: '0.23.1',
  runtimeVersion: '1.0.0',
  channel: 'preview',
  updateId: 'a1b2c3d4',
  publishedAt: '2026-08-21 09:42',
};

describe('BuildInfo', () => {
  it('marks an OTA launch and shows the update id', async () => {
    await render(<BuildInfo value={OTA} />);
    expect(screen.getByTestId('build-info-ota')).toBeTruthy();
    expect(screen.getByText('Over-the-air update')).toBeTruthy();
    expect(screen.getByText('a1b2c3d4')).toBeTruthy();
    expect(screen.getByText('2026-08-21 09:42')).toBeTruthy();
  });

  it('marks a bundle that shipped inside the app', async () => {
    await render(<BuildInfo value={{ ...OTA, source: 'embedded', updateId: '—' }} />);
    expect(screen.getByTestId('build-info-embedded')).toBeTruthy();
    expect(screen.getByText('Bundle shipped with the app')).toBeTruthy();
  });
});
