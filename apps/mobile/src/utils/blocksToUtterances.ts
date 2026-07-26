import type { CompactBlock, CompactFigure } from '@techtok/shared';

/** Flattens a compact-article block list into an ordered list of strings to
 * speak. List items become their own utterance each (so the pause between
 * them matches the pause between paragraphs); image blocks are skipped
 * unless they have a caption, since there's nothing else to read aloud. */
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
