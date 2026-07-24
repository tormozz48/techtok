import { extractFromHtml } from '@extractus/article-extractor';
import type { Topic } from '@techtok/shared';
import robotsParser from 'robots-parser';
import { toExcerpt } from '../ingest/htmlText';
import type { GenerateCardInput, GenerateCardResult } from '../llm/generateCard';
import type { TransformKind } from '../posts.types';
import type { TransformUpdateFields } from '../repos/postsRepo';
import { errorMessage } from '../util/errors';
import { isGenericImage } from './genericImageDenylist';

/** Single bot identity for everything TechTok fetches — the robots.txt check
 * below and the page/image fetches in `functions` must always agree on it. */
export const TECHTOK_BOT_USER_AGENT = 'TechTokBot/1.0 (+https://github.com/tormozz48/techtok)';

export interface TransformInput {
  readonly postId: string;
  readonly url: string;
  readonly title: string;
  readonly sourceName: string;
  /** The original (hotlinked) article image, if the ingest-time fallback
   * chain found one. Mirrored to our own CDN when present (see
   * `mirrorImage`). When absent, this function falls back to the page's
   * og:image (DESIGN §2 D24) before giving up on an image entirely. */
  readonly imageUrl?: string;
}

/** The transform write is the repo's update shape (single source of truth in
 * postsRepo.ts), narrowed to the only status a completed transform can set. */
export interface TransformFields extends Omit<TransformUpdateFields, 'status'> {
  readonly status: 'ready';
}

/** Outcome of trying to mirror one image candidate to our own CDN (D28).
 * `'ok'` and `'failed'` are content-level: `'failed'` degrades to the
 * original hotlinked url exactly as before D28. `'rejected'` is new — the
 * candidate decoded fine but failed the minimum-dimension quality gate, and
 * is distinct from `'failed'` specifically so the caller can cascade to the
 * next candidate instead of falling back to serving the low-quality image
 * directly. */
export type MirrorImageResult =
  | { readonly status: 'ok'; readonly url: string }
  | { readonly status: 'rejected' }
  | { readonly status: 'failed' };

export interface TransformDeps {
  /** Fetches `robots.txt` for the article's host. Returns `undefined` if it
   * can't be fetched (404, timeout, etc.) — treated as "allowed". */
  readonly fetchRobotsTxt: (robotsUrl: string) => Promise<string | undefined>;
  /** Fetches the article page HTML. Throws on non-2xx, timeout, or the 2MB
   * size cap — all content-level failures, caught by this function. */
  readonly fetchPage: (url: string) => Promise<string>;
  /** Archives the raw HTML to S3. An infra call — left unguarded so a
   * failure here propagates (SQS retry -> DLQ), not swallowed as a degrade. */
  readonly archiveRaw: (postId: string, html: string) => Promise<void>;
  /** Derives card copy + topic classification from the extracted article
   * text (DESIGN §7.4). Never expected to throw — an LLM refusal, invalid
   * output, or a Bedrock hiccup is a content-level failure reported via
   * `{ ok: false }` so this function can degrade to the excerpt card. */
  readonly generateCard: (input: GenerateCardInput) => Promise<GenerateCardResult>;
  /** Persists the transform result to DynamoDB. Also an infra call,
   * deliberately unguarded for the same reason as `archiveRaw`. */
  readonly updatePost: (postId: string, fields: TransformFields) => Promise<void>;
  /** Enqueues a translate job for every non-English language (D27) — every
   * post gets all its language variants queued eagerly at transform time, so
   * the feed never has to enqueue a translation on demand. An infra call,
   * deliberately unguarded for the same reason as `updatePost`. */
  readonly enqueueTranslations: (postId: string) => Promise<void>;
  /** Enqueues one compact-article generation job per language, for every
   * post (D36) — independent of the card LLM outcome and of
   * `enqueueTranslations`. An infra call, deliberately unguarded for the same
   * reason as `updatePost`. Implementations check the per-source
   * `compactEnabled` kill switch (D23) before enqueueing, so a disabled
   * source's posts never get queued in the first place. */
  readonly enqueueContentJobs: (postId: string) => Promise<void>;
  /** Mirrors an image candidate to our own CDN, gated by a minimum-dimension
   * quality check (D28). A content-level concern, not infra: this contract
   * never throws. `{ status: 'failed' }` (any fetch/upload error) degrades
   * to the original hotlinked `imageUrl`, same as before D28. `{ status:
   * 'rejected' }` (image decoded but is below the quality bar) is instead
   * meant to make the caller try the next candidate in the cascade, and
   * ultimately clear `imageUrl` if none pass. */
  readonly mirrorImage: (postId: string, imageUrl: string) => Promise<MirrorImageResult>;
}

export interface TransformOutcome {
  readonly degraded: boolean;
  readonly reason?: string;
}

/**
 * Fetches an article page, archives it, and derives a card — an LLM card
 * (DESIGN §7.4) when the article extracted cleanly, an improved excerpt
 * otherwise. Any content-level failure (robots disallow, fetch timeout/size
 * cap/non-2xx, extraction yielding nothing, LLM refusal/invalid output)
 * degrades to keeping the best fields available — the post still flips to
 * `ready` and the feed never starves. Every post, degraded or not, then gets
 * its non-English translations (D27) and its per-language compact-article
 * generation jobs (D36) enqueued eagerly. Infra failures (`archiveRaw`,
 * `updatePost`, `enqueueTranslations`, `enqueueContentJobs`) are not caught
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
  let ogImageUrl: string | undefined;
  if (html && !reason) {
    try {
      const article = await extractFromHtml(html, input.url);
      excerpt = article?.content ? toExcerpt(article.content) : undefined;
      fullText = article?.content ? toExcerpt(article.content, 4000) : undefined;
      if (!excerpt) reason = 'extraction produced no usable text';
      // D24: the page we already downloaded carries its own og:image — take
      // it regardless of how the text extraction went, as long as it isn't a
      // known-generic placeholder (e.g. arXiv's logo on every abstract page).
      if (article?.image && !isGenericImage(article.image)) {
        ogImageUrl = article.image;
      }
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

  // D28: try the ingest-time image first; a `'rejected'` (below the
  // minimum-dimension bar) cascades to the transform-time og:image (D24) as
  // a second candidate. A `'failed'` (infra-level) result never cascades and
  // never clears `imageUrl` — it degrades to the original hotlink exactly as
  // before D28. Only when every available candidate is rejected/absent do we
  // clear `imageUrl` so neither low-quality image gets served.
  let mirroredImageUrl: string | undefined;
  let bothCandidatesRejected = false;

  if (input.imageUrl) {
    const result = await deps.mirrorImage(input.postId, input.imageUrl);
    if (result.status === 'ok') {
      mirroredImageUrl = result.url;
    } else if (result.status === 'rejected') {
      if (ogImageUrl) {
        const ogResult = await deps.mirrorImage(input.postId, ogImageUrl);
        if (ogResult.status === 'ok') {
          mirroredImageUrl = ogResult.url;
        } else if (ogResult.status === 'rejected') {
          bothCandidatesRejected = true;
        }
      } else {
        bothCandidatesRejected = true;
      }
    }
  } else if (ogImageUrl) {
    const result = await deps.mirrorImage(input.postId, ogImageUrl);
    if (result.status === 'ok') {
      mirroredImageUrl = result.url;
    }
  }

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
    ...(bothCandidatesRejected ? { clearImageUrl: true } : {}),
  });

  await deps.enqueueTranslations(input.postId);
  await deps.enqueueContentJobs(input.postId);

  return reason ? { degraded: true, reason } : { degraded: false };
}

/** Shared with the content stage's live-fetch fallback (D23) — one robots.txt
 * check for every fetch TechTok's pipeline makes. */
export async function isAllowedByRobots(
  url: string,
  fetchRobotsTxt: TransformDeps['fetchRobotsTxt'],
): Promise<boolean> {
  const robotsUrl = new URL('/robots.txt', url).toString();
  const robotsTxt = await fetchRobotsTxt(robotsUrl);
  if (!robotsTxt) return true;
  return robotsParser(robotsUrl, robotsTxt).isAllowed(url, TECHTOK_BOT_USER_AGENT) ?? true;
}
