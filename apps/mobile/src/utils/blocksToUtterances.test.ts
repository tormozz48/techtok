import type { CompactBlock, CompactFigure } from '@techtok/shared';
import { blocksToUtterances } from './blocksToUtterances';

describe('blocksToUtterances', () => {
  it('speaks heading, paragraph, and quote blocks as their own text', () => {
    const blocks: CompactBlock[] = [
      { type: 'heading', text: 'A big claim' },
      { type: 'paragraph', text: 'The details follow.' },
      { type: 'quote', text: 'Someone important said something.' },
    ];

    expect(blocksToUtterances(blocks, [])).toEqual([
      'A big claim',
      'The details follow.',
      'Someone important said something.',
    ]);
  });

  it('speaks each list item as its own utterance', () => {
    const blocks: CompactBlock[] = [{ type: 'list', items: ['First', 'Second', 'Third'] }];

    expect(blocksToUtterances(blocks, [])).toEqual(['First', 'Second', 'Third']);
  });

  it('speaks an image caption when present', () => {
    const blocks: CompactBlock[] = [{ type: 'image', figureIndex: 0 }];
    const figures: CompactFigure[] = [{ url: 'https://example.com/a.jpg', caption: 'A rocket' }];

    expect(blocksToUtterances(blocks, figures)).toEqual(['A rocket']);
  });

  it('skips an image block with no caption', () => {
    const blocks: CompactBlock[] = [{ type: 'image', figureIndex: 0 }];
    const figures: CompactFigure[] = [{ url: 'https://example.com/a.jpg' }];

    expect(blocksToUtterances(blocks, figures)).toEqual([]);
  });

  it('skips an image block whose figureIndex has no matching figure', () => {
    const blocks: CompactBlock[] = [{ type: 'image', figureIndex: 5 }];

    expect(blocksToUtterances(blocks, [])).toEqual([]);
  });

  it('preserves block order across a mixed article', () => {
    const blocks: CompactBlock[] = [
      { type: 'heading', text: 'Title' },
      { type: 'paragraph', text: 'Intro.' },
      { type: 'list', items: ['A', 'B'] },
      { type: 'paragraph', text: 'Conclusion.' },
    ];

    expect(blocksToUtterances(blocks, [])).toEqual(['Title', 'Intro.', 'A', 'B', 'Conclusion.']);
  });

  it('returns an empty array for an empty block list', () => {
    expect(blocksToUtterances([], [])).toEqual([]);
  });
});
