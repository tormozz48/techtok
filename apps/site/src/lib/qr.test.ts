import { describe, expect, it } from 'vitest';
import { PLAY_TESTING_URL } from './download';
import { qrSvg } from './qr';

describe('download constants', () => {
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
