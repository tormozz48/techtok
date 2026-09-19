import { describe, expect, it } from 'vitest';
import { APK_DOWNLOAD_URL, GITHUB_REPO_URL, PLAY_TESTING_URL, RELEASES_URL } from './download';
import { qrSvg } from './qr';

describe('download constants', () => {
  it('points the APK link at the stable releases/latest alias', () => {
    expect(APK_DOWNLOAD_URL).toBe(
      'https://github.com/tormozz48/techtok/releases/latest/download/techtok.apk',
    );
  });

  it('derives the releases URL from the repo URL', () => {
    expect(RELEASES_URL).toBe(`${GITHUB_REPO_URL}/releases`);
    expect(APK_DOWNLOAD_URL.startsWith(RELEASES_URL)).toBe(true);
  });

  it('points the Play testing link at the closed-testing opt-in URL', () => {
    expect(PLAY_TESTING_URL).toBe('https://play.google.com/apps/testing/com.tormozz48dev.techtok');
  });
});

describe('qrSvg', () => {
  it('renders an SVG document encoding the given text', async () => {
    const svg = await qrSvg(PLAY_TESTING_URL);
    expect(svg.trim().startsWith('<svg')).toBe(true);
    expect(svg).toContain('</svg>');
  });
});
