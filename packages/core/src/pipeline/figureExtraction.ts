import { load } from 'cheerio';
import { isGenericImage } from './genericImageDenylist';

const MIN_DIMENSION_PX = 200;
const MAX_FIGURES = 5;

export interface ExtractedFigure {
  readonly url: string;
  readonly caption?: string;
}

export function extractFigures(articleHtml: string, leadImageUrl?: string): ExtractedFigure[] {
  const $ = load(articleHtml);
  const figures: ExtractedFigure[] = [];
  const seen = new Set<string>(leadImageUrl ? [leadImageUrl] : []);

  $('img').each((_, el) => {
    if (figures.length >= MAX_FIGURES) return false;

    const $img = $(el);
    const src = $img.attr('src') ?? $img.attr('data-src');
    if (!src || !/^https?:\/\//i.test(src) || seen.has(src) || isGenericImage(src)) return;

    const width = Number($img.attr('width'));
    const height = Number($img.attr('height'));
    if (width && width < MIN_DIMENSION_PX) return;
    if (height && height < MIN_DIMENSION_PX) return;

    const caption =
      $img.closest('figure').find('figcaption').first().text().trim() ||
      $img.attr('alt')?.trim() ||
      undefined;

    seen.add(src);
    figures.push({ url: src, caption });
  });

  return figures;
}
