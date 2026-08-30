import type { CompactBlock, CompactFigure } from '@techtok/shared';

export function blocksToPlainText(blocks: CompactBlock[], figures: CompactFigure[]): string {
  const parts: string[] = [];

  for (const block of blocks) {
    switch (block.type) {
      case 'heading':
      case 'paragraph':
      case 'quote':
        parts.push(block.text);
        break;
      case 'list':
        parts.push(block.items.map((item) => `• ${item}`).join('\n'));
        break;
      case 'image': {
        const caption = figures[block.figureIndex]?.caption;
        if (caption) parts.push(caption);
        break;
      }
    }
  }

  return parts.join('\n\n');
}
