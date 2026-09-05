import type { CompactBlock, CompactFigure } from '@techtok/shared';
import { describe, expect, it } from 'vitest';
import { blocksToPlainText } from './blocksToPlainText';

describe('blocksToPlainText', () => {
  it('joins heading, paragraph, and quote blocks with blank lines between them', () => {
    const blocks: CompactBlock[] = [
      { type: 'heading', text: 'A big claim' },
      { type: 'paragraph', text: 'The details follow.' },
      { type: 'quote', text: 'Someone important said something.' },
    ];

    expect(blocksToPlainText(blocks, [])).toBe(
      'A big claim\n\nThe details follow.\n\nSomeone important said something.',
    );
  });

  it('renders list items as a bulleted block', () => {
    const blocks: CompactBlock[] = [{ type: 'list', items: ['First', 'Second', 'Third'] }];

    expect(blocksToPlainText(blocks, [])).toBe('• First\n• Second\n• Third');
  });

  it('includes an image caption when present', () => {
    const blocks: CompactBlock[] = [{ type: 'image', figureIndex: 0 }];
    const figures: CompactFigure[] = [{ url: 'https://example.com/a.jpg', caption: 'A rocket' }];

    expect(blocksToPlainText(blocks, figures)).toBe('A rocket');
  });

  it('skips an image block with no caption', () => {
    const blocks: CompactBlock[] = [{ type: 'image', figureIndex: 0 }];
    const figures: CompactFigure[] = [{ url: 'https://example.com/a.jpg' }];

    expect(blocksToPlainText(blocks, figures)).toBe('');
  });

  it('skips an image block whose figureIndex has no matching figure', () => {
    const blocks: CompactBlock[] = [{ type: 'image', figureIndex: 5 }];

    expect(blocksToPlainText(blocks, [])).toBe('');
  });

  it('preserves block order across a mixed article', () => {
    const blocks: CompactBlock[] = [
      { type: 'heading', text: 'Title' },
      { type: 'paragraph', text: 'Intro.' },
      { type: 'list', items: ['A', 'B'] },
      { type: 'paragraph', text: 'Conclusion.' },
    ];

    expect(blocksToPlainText(blocks, [])).toBe('Title\n\nIntro.\n\n• A\n• B\n\nConclusion.');
  });

  it('returns an empty string for an empty block list', () => {
    expect(blocksToPlainText([], [])).toBe('');
  });
});
