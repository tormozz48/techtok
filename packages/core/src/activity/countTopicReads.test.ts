import { describe, expect, it } from 'vitest';
import { countTopicReads } from './countTopicReads';

describe('countTopicReads', () => {
  it('returns an empty object for no topics', () => {
    expect(countTopicReads([])).toEqual({});
  });

  it('tallies a single topic across repeats', () => {
    expect(countTopicReads(['ai', 'ai', 'ai'])).toEqual({ ai: 3 });
  });

  it('tallies multiple distinct topics independently', () => {
    expect(countTopicReads(['ai', 'dev', 'ai', 'science'])).toEqual({ ai: 2, dev: 1, science: 1 });
  });
});
