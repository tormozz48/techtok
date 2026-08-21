import type { CompactBlock, CompactFigure } from '@techtok/shared';

export function blocksToUtterances(blocks: CompactBlock[], figures: CompactFigure[]): string[] {
  const utterances: string[] = [];

  for (const block of blocks) {
    switch (block.type) {
      case 'heading':
      case 'paragraph':
      case 'quote':
        utterances.push(block.text);
        break;
      case 'list':
        utterances.push(...block.items);
        break;
      case 'image': {
        const caption = figures[block.figureIndex]?.caption;
        if (caption) utterances.push(caption);
        break;
      }
    }
  }

  return utterances;
}
