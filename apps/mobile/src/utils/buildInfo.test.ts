import { describe, expect, it } from 'vitest';
import { describeBuild } from './buildInfo';

const OTA_INPUT = {
  bundleVersion: '0.23.1',
  runtimeVersion: '1.0.0',
  channel: 'preview',
  updateId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  createdAt: new Date('2026-08-21T09:42:17.000Z'),
  isEmbeddedLaunch: false,
};

describe('describeBuild', () => {
  it('reports an OTA launch and shortens the update id', () => {
    expect(describeBuild(OTA_INPUT)).toEqual({
      source: 'ota',
      bundleVersion: '0.23.1',
      runtimeVersion: '1.0.0',
      channel: 'preview',
      updateId: 'a1b2c3d4',
      publishedAt: '2026-08-21 09:42',
    });
  });

  it('reports an embedded launch even when an update id is present', () => {
    expect(describeBuild({ ...OTA_INPUT, isEmbeddedLaunch: true }).source).toBe('embedded');
  });

  it('falls back to embedded when there is no update id', () => {
    const info = describeBuild({ ...OTA_INPUT, updateId: null, isEmbeddedLaunch: false });
    expect(info.source).toBe('embedded');
    expect(info.updateId).toBe('—');
  });

  it('placeholders the fields Expo Go leaves empty', () => {
    expect(
      describeBuild({
        bundleVersion: '0.23.1',
        runtimeVersion: null,
        channel: '',
        updateId: undefined,
        createdAt: null,
        isEmbeddedLaunch: false,
      }),
    ).toEqual({
      source: 'embedded',
      bundleVersion: '0.23.1',
      runtimeVersion: '—',
      channel: '—',
      updateId: '—',
      publishedAt: '—',
    });
  });

  it('placeholders an invalid createdAt instead of rendering NaN', () => {
    expect(describeBuild({ ...OTA_INPUT, createdAt: new Date('nope') }).publishedAt).toBe('—');
  });
});
