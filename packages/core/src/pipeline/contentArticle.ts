import { extractFromHtml } from '@extractus/article-extractor';
import type { CompactBlock, CompactFigure, Language } from '@techtok/shared';
import { toExcerpt } from '../ingest/htmlText';
import type { CompactArticleResult } from '../llm/compactArticle';
import { errorMessage } from '../util/errors';
import { type ExtractedFigure, extractFigures } from './figureExtraction';

const ARTICLE_TEXT_MAX_CHARS = 8000;

export interface ContentInput {
  readonly postId: string;
  readonly lang: Language;
  readonly title: string;
  readonly sourceName: string;
  readonly url: string;
  readonly leadImageUrl?: string;
  readonly mirroredFigures?: CompactFigure[];
}

export interface ContentDeps {
  readonly compactEnabled: () => Promise<boolean>;
  readonly loadArticleHtml: () => Promise<string>;
  readonly mirrorFigures: (figures: ExtractedFigure[]) => Promise<CompactFigure[]>;
  readonly saveMirroredFigures: (figures: CompactFigure[]) => Promise<void>;
  readonly generateCompact: (input: {
    lang: Language;
    title: string;
    sourceName: string;
    articleText: string;
    figures: { index: number; caption?: string }[];
  }) => Promise<CompactArticleResult>;
  readonly writeContent: (blocks: CompactBlock[], figures: CompactFigure[]) => Promise<void>;
}

export type ContentOutcome =
  | { readonly ok: true; readonly blocks: CompactBlock[]; readonly figures: CompactFigure[] }
  | { readonly ok: false; readonly reason: string };

export async function generateContentArticle(
  input: ContentInput,
  deps: ContentDeps,
): Promise<ContentOutcome> {
  if (!(await deps.compactEnabled())) {
    return { ok: false, reason: 'compact reader disabled for this source' };
  }

  let html: string;
  try {
    html = await deps.loadArticleHtml();
  } catch (err) {
    return { ok: false, reason: `article unavailable: ${errorMessage(err)}` };
  }

  let articleHtml: string | undefined;
  let articleText: string | undefined;
  try {
    const article = await extractFromHtml(html, input.url);
    articleHtml = article?.content;
    articleText = article?.content ? toExcerpt(article.content, ARTICLE_TEXT_MAX_CHARS) : undefined;
  } catch (err) {
    return { ok: false, reason: `extraction failed: ${errorMessage(err)}` };
  }
  if (!articleHtml || !articleText) {
    return { ok: false, reason: 'extraction produced no usable text' };
  }

  let figures: CompactFigure[];
  if (input.mirroredFigures) {
    figures = input.mirroredFigures;
  } else {
    const candidateFigures = extractFigures(articleHtml, input.leadImageUrl);
    figures = await deps.mirrorFigures(candidateFigures);
    await deps.saveMirroredFigures(figures);
  }

  const result = await deps.generateCompact({
    lang: input.lang,
    title: input.title,
    sourceName: input.sourceName,
    articleText,
    figures: figures.map((figure, index) => ({ index, caption: figure.caption })),
  });
  if (!result.ok) {
    return { ok: false, reason: `llm failed: ${result.reason}` };
  }

  await deps.writeContent(result.compact.blocks, figures);
  return { ok: true, blocks: result.compact.blocks, figures };
}
