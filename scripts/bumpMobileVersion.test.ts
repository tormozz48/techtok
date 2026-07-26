import { describe, expect, it } from 'vitest';
import { applyBump, classifyCommit, highestBump } from './bumpMobilePrVersion';

describe('classifyCommit', () => {
  it('classifies feat as minor', () => {
    expect(classifyCommit('feat: add topic filter')).toBe('minor');
  });

  it('classifies fix as patch', () => {
    expect(classifyCommit('fix: correct feed cursor')).toBe('patch');
  });

  it('classifies a scoped commit', () => {
    expect(classifyCommit('feat(mobile): add dark mode toggle')).toBe('minor');
  });

  it('classifies a `!` breaking marker as major', () => {
    expect(classifyCommit('feat!: drop legacy endpoint')).toBe('major');
  });

  it('classifies a BREAKING CHANGE footer as major regardless of header type', () => {
    expect(
      classifyCommit('fix: correct feed cursor\n\nBREAKING CHANGE: removes the old cursor format'),
    ).toBe('major');
  });

  it('classifies chore/docs/test/refactor as no bump', () => {
    expect(classifyCommit('chore: update deps')).toBe('none');
    expect(classifyCommit('docs: fix typo')).toBe('none');
    expect(classifyCommit('test: add coverage')).toBe('none');
    expect(classifyCommit('refactor: simplify')).toBe('none');
  });

  it('classifies a non-conventional message as no bump', () => {
    expect(classifyCommit('wip')).toBe('none');
  });
});

describe('highestBump', () => {
  it('returns the highest-ranked bump across messages', () => {
    expect(highestBump(['fix: a', 'chore: b', 'feat: c'])).toBe('minor');
  });

  it('returns major if any commit is breaking', () => {
    expect(highestBump(['feat: a', 'feat!: b', 'fix: c'])).toBe('major');
  });

  it('returns none for an empty list', () => {
    expect(highestBump([])).toBe('none');
  });

  it('returns none when nothing bumps', () => {
    expect(highestBump(['chore: a', 'docs: b'])).toBe('none');
  });
});

describe('applyBump', () => {
  it('bumps major and resets minor/patch', () => {
    expect(applyBump('1.2.3', 'major')).toBe('2.0.0');
  });

  it('bumps minor and resets patch', () => {
    expect(applyBump('1.2.3', 'minor')).toBe('1.3.0');
  });

  it('bumps patch only', () => {
    expect(applyBump('1.2.3', 'patch')).toBe('1.2.4');
  });

  it('leaves the version unchanged for none', () => {
    expect(applyBump('1.2.3', 'none')).toBe('1.2.3');
  });
});
