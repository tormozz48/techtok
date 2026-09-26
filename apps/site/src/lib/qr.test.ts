import { describe, expect, it } from 'vitest';
import {
  APK_DOWNLOAD_URL,
  GITHUB_REPO_URL,
  PLAY_STORE_URL,
  PLAY_TESTING_URL,
  playInviteUrl,
  RELEASES_URL,
} from './download';
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

describe('playInviteUrl', () => {
  it('sends Android devices to the Play Store listing', () => {
    expect(
      playInviteUrl(
        'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/128 Mobile',
      ),
    ).toBe(PLAY_STORE_URL);
  });

  it('sends every other device to the web testing opt-in', () => {
    expect(playInviteUrl('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)')).toBe(
      PLAY_TESTING_URL,
    );
    expect(playInviteUrl('Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) Safari/605.1.15')).toBe(
      PLAY_TESTING_URL,
    );
  });
});

describe('qrSvg', () => {
  it('renders an SVG document encoding the given text', async () => {
    const svg = await qrSvg(PLAY_TESTING_URL);
    expect(svg.trim().startsWith('<svg')).toBe(true);
    expect(svg).toContain('</svg>');
  });
});
