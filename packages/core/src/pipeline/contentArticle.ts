import { extractFromHtml } from '@extractus/article-extractor';
import type { CompactBlock, CompactFigure, Language } from '@techtok/shared';
import { toExcerpt } from '../ingest/htmlText';
import type { CompactArticleResult } from '../llm/compactArticle';
import { errorMessage } from '../util/errors';
import { type ExtractedFigure, extractFigures } from './figureExtraction';

// ~8,000 chars of article text feeds the compact-article LLM call (DESIGN §7.4).
const ARTICLE_TEXT_MAX_CHARS = 8000;

export interface ContentInput {
  readonly postId: string;
  readonly lang: Language;
  readonly title: string;
  readonly sourceName: string;
  readonly url: string;
  /** The post's lead image (mirrored or original hotlink), used only to
   * dedup in-body figures against it — never itself a figure candidate. */
  readonly leadImageUrl?: string;
}

export interface ContentDeps {
  /** Per-source compact-reader kill switch (D23). Checked before any work —
   * `false` means the source opted out, never generate for its posts. */
  readonly compactEnabled: () => Promise<boolean>;
  /** Atomically increments today's compact counter (DESIGN §6/D23) and
   * reports whether this generation is still under the daily cap. Over cap
   * is not a failure — it's the cost valve doing its job. */
  readonly checkDailyCap: () => Promise<boolean>;
  /** Loads the article's HTML — archived raw HTML first, one live fetch
   * attempt if unavailable (robots-respecting, same caps as transform). Any
   * failure (S3 miss and fetch failure both) is a content-level failure the
   * caller degrades from — never thrown further than here. */
  readonly loadArticleHtml: () => Promise<string>;
  /** Mirrors candidate figures to our own CDN. A content-level concern, not
   * infra: never throws — any per-figure fetch/upload failure is dropped
   * from the returned list rather than failing the whole request. */
  readonly mirrorFigures: (figures: ExtractedFigure[]) => Promise<CompactFigure[]>;
  /** Derives the compact block list via the LLM (D23). Never expected to
   * throw — an LLM refusal, invalid output, or a Bedrock hiccup is a
   * content-level failure reported via `{ ok: false }`. */
  readonly generateCompact: (input: {
    lang: Language;
    title: string;
    sourceName: string;
    articleText: string;
    figures: { index: number; caption?: string }[];
  }) => Promise<CompactArticleResult>;
  /** Persists the generated content (S3 JSON + `Posts.compactLangs`). An
   * infra call, deliberately unguarded — a failure here should surface as a
   * genuine 500 to the caller, not a silent degrade. */
  readonly writeContent: (blocks: CompactBlock[], figures: CompactFigure[]) => Promise<void>;
}

export type ContentOutcome =
  | { readonly ok: true; readonly blocks: CompactBlock[]; readonly figures: CompactFigure[] }
  | { readonly ok: false; readonly reason: string };

/**
 * Generates a compact in-app reader article for a post (D23): guardrails
 * (kill switch, daily cap) first, then archive-first article loading, figure
 * extraction + mirroring, and a single-pass compress+translate LLM call. Any
 * content-level failure (kill switch, over cap, article unavailable,
 * extraction yielding nothing, LLM refusal/invalid output) reports
 * `{ ok: false }` — the caller (the content API handler) degrades to the
 * in-app browser link-out, never a dead end. Only `writeContent`'s own infra
 * failure is left to throw.
 */
export async function generateContentArticle(
  input: ContentInput,
  deps: ContentDeps,
): Promise<ContentOutcome> {
  if (!(await deps.compactEnabled())) {
    return { ok: false, reason: 'compact reader disabled for this source' };
  }
  if (!(await deps.checkDailyCap())) {
    return { ok: false, reason: 'over daily compact cap' };
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

  const candidateFigures = extractFigures(articleHtml, input.leadImageUrl);
  const figures = await deps.mirrorFigures(candidateFigures);

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
