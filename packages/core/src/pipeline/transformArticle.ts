import { extractFromHtml } from '@extractus/article-extractor';
import robotsParser from 'robots-parser';
import { toExcerpt } from '../ingest/htmlText';

const USER_AGENT = 'TechTokBot/1.0 (+https://github.com/tormozz48/techtok)';

export interface TransformInput {
  postId: string;
  url: string;
}

export interface TransformFields {
  status: 'ready';
  transform: 'excerpt';
  summary?: string;
  excerpt?: string;
  s3RawKey?: string;
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
  /** Persists the transform result to DynamoDB. Also an infra call,
   * deliberately unguarded for the same reason as `archiveRaw`. */
  updatePost: (postId: string, fields: TransformFields) => Promise<void>;
}

export interface TransformOutcome {
  degraded: boolean;
  reason?: string;
}

/**
 * Fetches an article page, archives it, and derives an improved excerpt —
 * the phase-2 shape of the transform stage (DESIGN §7.2), before the LLM
 * exists. Any content-level failure (robots disallow, fetch timeout/size
 * cap/non-2xx, extraction yielding nothing) degrades to keeping the
 * RSS-derived fields already on the post from discovery — the post still
 * flips to `ready` and the feed never starves. Infra failures (`archiveRaw`,
 * `updatePost`) are not caught here; they throw so SQS's own retry/DLQ
 * semantics take over.
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
    reason = `fetch failed: ${toMessage(err)}`;
  }

  let excerpt: string | undefined;
  if (html && !reason) {
    try {
      const article = await extractFromHtml(html, input.url);
      excerpt = article?.content ? toExcerpt(article.content) : undefined;
      if (!excerpt) reason = 'extraction produced no usable text';
    } catch (err) {
      reason = `extraction failed: ${toMessage(err)}`;
    }
  }

  let s3RawKey: string | undefined;
  if (html) {
    s3RawKey = `raw/${input.postId}.html`;
    await deps.archiveRaw(input.postId, html);
  }

  await deps.updatePost(input.postId, {
    status: 'ready',
    transform: 'excerpt',
    s3RawKey,
    ...(excerpt ? { summary: excerpt, excerpt } : {}),
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
  return robotsParser(robotsUrl, robotsTxt).isAllowed(url, USER_AGENT) ?? true;
}

function toMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
