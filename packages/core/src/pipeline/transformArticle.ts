import { extractFromHtml } from '@extractus/article-extractor';
import type { Topic } from '@techtok/shared';
import robotsParser from 'robots-parser';
import { toExcerpt } from '../ingest/htmlText';
import type { GenerateCardResult } from '../llm/generateCard';
import type { TransformKind } from '../posts/types';
import { errorMessage } from '../util/errors';

/** Single bot identity for everything TechTok fetches — the robots.txt check
 * below and the page/image fetches in `functions` must always agree on it. */
export const TECHTOK_BOT_USER_AGENT = 'TechTokBot/1.0 (+https://github.com/tormozz48/techtok)';

export interface TransformInput {
  postId: string;
  url: string;
  title: string;
  sourceName: string;
  /** The original (hotlinked) article image, if the ingest-time fallback
   * chain found one. Mirrored to our own CDN when present (see `mirrorImage`). */
  imageUrl?: string;
}

export interface TransformFields {
  status: 'ready';
  transform: TransformKind;
  summary?: string;
  excerpt?: string;
  s3RawKey?: string;
  cardTitle?: string;
  whyItMatters?: string;
  primaryTopic?: Topic;
  topics?: Topic[];
  lang?: string;
  mirroredImageUrl?: string;
}

export interface TransformDeps {
  /** Fetches `robots.txt` for the article's host. Returns `undefined` if it
   * can't be fetched (404, timeout, etc.) — treated as "allowed". */
  fetchRobotsTxt: (robotsUrl: string) => Promise<string | undefined>;
  /** Fetches the article page HTML. Throws on non-2xx, timeout, or the 2MB
   * size cap — all content-level failures, caught by this function. */
  fetchPage: (url: string) => Promise<string>;
  /** Archives the raw HTML to S3. An infra call — left unguarded so a
   * failure here propagates (SQS retry -> DLQ), not swallowed as a degrade. */
  archiveRaw: (postId: string, html: string) => Promise<void>;
  /** Atomically increments today's transform counter (DESIGN §6/§7.4) and
   * reports whether the article is still under the daily LLM cap. Over cap
   * is not a failure — it's the cost valve doing its job — so the post ships
   * as `transform: 'skipped'`, never blocking the feed. */
  checkDailyCap: () => Promise<boolean>;
  /** Derives card copy + topic classification from the extracted article
   * text (DESIGN §7.4). Never expected to throw — an LLM refusal, invalid
   * output, or a Bedrock hiccup is a content-level failure reported via
   * `{ ok: false }` so this function can degrade to the excerpt card. */
  generateCard: (input: {
    title: string;
    sourceName: string;
    text: string;
  }) => Promise<GenerateCardResult>;
  /** Persists the transform result to DynamoDB. Also an infra call,
   * deliberately unguarded for the same reason as `archiveRaw`. */
  updatePost: (postId: string, fields: TransformFields) => Promise<void>;
  /** Mirrors the article's hotlinked image to our own CDN. A content-level
   * concern, not infra: this contract never throws — any fetch/upload
   * failure is caught by the implementation and reported as `undefined`,
   * so the post always falls back to the original hotlinked `imageUrl`. */
  mirrorImage: (postId: string, imageUrl: string) => Promise<string | undefined>;
}

export interface TransformOutcome {
  degraded: boolean;
  reason?: string;
}

/**
 * Fetches an article page, archives it, and derives a card — an LLM card
 * (DESIGN §7.4) when the article extracted cleanly and the daily transform
 * cap isn't exhausted, an improved excerpt otherwise. Any content-level
 * failure (robots disallow, fetch timeout/size cap/non-2xx, extraction
 * yielding nothing, LLM refusal/invalid output) degrades to keeping the
 * best fields available — the post still flips to `ready` and the feed
 * never starves. Infra failures (`archiveRaw`, `updatePost`) are not caught
 * here; they throw so SQS's own retry/DLQ semantics take over.
 */
export async function transformArticle(
  input: TransformInput,
  deps: TransformDeps,
): Promise<TransformOutcome> {
  let html: string | undefined;
  let reason: string | undefined;

  try {
    const allowed = await isAllowedByRobots(input.url, deps.fetchRobotsTxt);
    if (!allowed) {
      reason = 'disallowed by robots.txt';
    } else {
      html = await deps.fetchPage(input.url);
    }
  } catch (err) {
    reason = `fetch failed: ${errorMessage(err)}`;
  }

  let excerpt: string | undefined;
  let fullText: string | undefined;
  if (html && !reason) {
    try {
      const article = await extractFromHtml(html, input.url);
      excerpt = article?.content ? toExcerpt(article.content) : undefined;
      fullText = article?.content ? toExcerpt(article.content, 4000) : undefined;
      if (!excerpt) reason = 'extraction produced no usable text';
    } catch (err) {
      reason = `extraction failed: ${errorMessage(err)}`;
    }
  }

  let s3RawKey: string | undefined;
  if (html) {
    s3RawKey = `raw/${input.postId}.html`;
    await deps.archiveRaw(input.postId, html);
  }

  let transform: TransformKind = 'excerpt';
  let summary = excerpt;
  let cardTitle: string | undefined;
  let whyItMatters: string | undefined;
  let primaryTopic: Topic | undefined;
  let topics: Topic[] | undefined;
  let lang: string | undefined;

  if (fullText && !reason) {
    const underCap = await deps.checkDailyCap();
    if (!underCap) {
      transform = 'skipped';
    } else {
      const result = await deps.generateCard({
        title: input.title,
        sourceName: input.sourceName,
        text: fullText,
      });
      if (result.ok) {
        transform = 'llm';
        summary = result.card.summary;
        cardTitle = result.card.cardTitle;
        whyItMatters = result.card.whyItMatters;
        primaryTopic = result.card.primaryTopic;
        topics = result.card.topics;
        lang = result.card.lang;
      } else {
        reason = `llm failed: ${result.reason}`;
      }
    }
  }

  const mirroredImageUrl = input.imageUrl
    ? await deps.mirrorImage(input.postId, input.imageUrl)
    : undefined;

  await deps.updatePost(input.postId, {
    status: 'ready',
    transform,
    s3RawKey,
    ...(summary ? { summary } : {}),
    ...(excerpt ? { excerpt } : {}),
    ...(cardTitle ? { cardTitle } : {}),
    ...(whyItMatters ? { whyItMatters } : {}),
    ...(primaryTopic ? { primaryTopic } : {}),
    ...(topics ? { topics } : {}),
    ...(lang ? { lang } : {}),
    ...(mirroredImageUrl ? { mirroredImageUrl } : {}),
  });

  return reason ? { degraded: true, reason } : { degraded: false };
}

async function isAllowedByRobots(
  url: string,
  fetchRobotsTxt: TransformDeps['fetchRobotsTxt'],
): Promise<boolean> {
  const robotsUrl = new URL('/robots.txt', url).toString();
  const robotsTxt = await fetchRobotsTxt(robotsUrl);
  if (!robotsTxt) return true;
  return robotsParser(robotsUrl, robotsTxt).isAllowed(url, TECHTOK_BOT_USER_AGENT) ?? true;
}
