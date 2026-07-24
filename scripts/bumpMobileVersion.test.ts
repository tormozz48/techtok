import { describe, expect, it } from 'vitest';
import { applyBump, classifyCommit, highestBump } from './bumpMobileVersion';

describe('classifyCommit', () => {
  it('classifies feat: as minor', () => {
    expect(classifyCommit('feat: add bookmark sharing')).toBe('minor');
  });

  it('classifies fix: as patch', () => {
    expect(classifyCommit('fix: correct read-queue flush timer')).toBe('patch');
  });

  it('classifies a scoped type the same as unscoped', () => {
    expect(classifyCommit('feat(mobile): add dark mode toggle')).toBe('minor');
  });

  it('classifies feat!: as major', () => {
    expect(classifyCommit('feat!: drop legacy device-id header')).toBe('major');
  });

  it('classifies a BREAKING CHANGE: footer as major regardless of header type', () => {
    expect(
      classifyCommit('fix: correct read-queue timer\n\nBREAKING CHANGE: removes the old flush API'),
    ).toBe('major');
  });

  it('classifies docs/chore/refactor/test as no bump', () => {
    expect(classifyCommit('docs: update README')).toBe('none');
    expect(classifyCommit('chore: bump a dependency')).toBe('none');
    expect(classifyCommit('refactor: extract a helper')).toBe('none');
    expect(classifyCommit('test: add a missing case')).toBe('none');
  });

  it('classifies a message with no conventional-commit header as no bump', () => {
    expect(classifyCommit('Merge pull request #1 from foo/bar')).toBe('none');
  });
});

describe('highestBump', () => {
  it('picks the highest-ranked bump across all messages', () => {
    expect(highestBump(['docs: update README', 'fix: a bug', 'feat: a feature'])).toBe('minor');
  });

  it('major always wins over minor/patch', () => {
    expect(highestBump(['feat: a feature', 'feat!: a breaking feature'])).toBe('major');
  });

  it('returns none for an empty list', () => {
    expect(highestBump([])).toBe('none');
  });
});

describe('applyBump', () => {
  it('bumps patch', () => {
    expect(applyBump('1.2.3', 'patch')).toBe('1.2.4');
  });

  it('bumps minor and resets patch', () => {
    expect(applyBump('1.2.3', 'minor')).toBe('1.3.0');
  });

  it('bumps major and resets minor/patch', () => {
    expect(applyBump('1.2.3', 'major')).toBe('2.0.0');
  });

  it('leaves the version unchanged for none', () => {
    expect(applyBump('1.2.3', 'none')).toBe('1.2.3');
  });
});
