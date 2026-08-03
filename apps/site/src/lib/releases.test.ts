import { describe, expect, it } from 'vitest';
import { parseChangelog } from './releases';

describe('parseChangelog', () => {
  it('buckets a fully-sectioned Features+Fixes message (D58 format)', () => {
    const message = [
      "## What's changed",
      '',
      '### Features',
      '- add topic filter',
      '- add dark mode toggle',
      '',
      '### Fixes',
      '- correct feed cursor',
      '',
    ].join('\n');

    expect(parseChangelog(message)).toEqual({
      features: ['add topic filter', 'add dark mode toggle'],
      fixes: ['correct feed cursor'],
      other: [],
    });
  });

  it('handles a Features-only message', () => {
    const message = ["## What's changed", '', '### Features', '- add topic filter', ''].join('\n');

    expect(parseChangelog(message)).toEqual({
      features: ['add topic filter'],
      fixes: [],
      other: [],
    });
  });

  it('handles a Fixes-only message', () => {
    const message = ["## What's changed", '', '### Fixes', '- correct feed cursor', ''].join('\n');

    expect(parseChangelog(message)).toEqual({
      features: [],
      fixes: ['correct feed cursor'],
      other: [],
    });
  });

  it("buckets an unsectioned flat bullet list into `other` (today's actual tag format)", () => {
    const message = [
      '- gate feed loading screen on persist-cache restore',
      '- recover feeds with a valueless XML attribute',
      '- skip cross-source dedup lookup for already-known posts',
      '',
    ].join('\n');

    expect(parseChangelog(message)).toEqual({
      features: [],
      fixes: [],
      other: [
        'gate feed loading screen on persist-cache restore',
        'recover feeds with a valueless XML attribute',
        'skip cross-source dedup lookup for already-known posts',
      ],
    });
  });

  it('falls back to the raw line for a bare, non-bulleted message', () => {
    expect(parseChangelog('chore(mobile): bump version to 0.11.2 [skip ci]')).toEqual({
      features: [],
      fixes: [],
      other: ['chore(mobile): bump version to 0.11.2 [skip ci]'],
    });
  });

  it('unwraps the italic "no user-facing changes" fallback note', () => {
    const message = [
      "## What's changed",
      '',
      '_No user-facing feat/fix commits since the last release._',
      '',
    ].join('\n');

    expect(parseChangelog(message)).toEqual({
      features: [],
      fixes: [],
      other: ['No user-facing feat/fix commits since the last release.'],
    });
  });

  it('returns all-empty for a blank message', () => {
    expect(parseChangelog('')).toEqual({ features: [], fixes: [], other: [] });
  });
});
