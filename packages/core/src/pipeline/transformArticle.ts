import { extractFromHtml } from '@extractus/article-extractor';
import type { Topic } from '@techtok/shared';
import robotsParser from 'robots-parser';
import { toExcerpt } from '../ingest/htmlText';
import type { GenerateCardInput, GenerateCardResult } from '../llm/generateCard';
import type { TransformKind } from '../posts.types';
import type { TransformUpdateFields } from '../repos/postsRepo';
import { errorMessage } from '../util/errors';
import { isGenericImage } from './genericImageDenylist';

export const TECHTOK_BOT_USER_AGENT = 'TechTokBot/1.0 (+https://github.com/tormozz48/techtok)';

export interface TransformInput {
  readonly postId: string;
  readonly contentKey: string;
  readonly url: string;
  readonly title: string;
  readonly sourceName: string;
  readonly imageUrl?: string;
}

export interface TransformFields extends Omit<TransformUpdateFields, 'status'> {
  readonly status: 'ready';
}

export type MirrorImageResult =
  | { readonly status: 'ok'; readonly url: string }
  | { readonly status: 'rejected' }
  | { readonly status: 'failed' };

export interface TransformDeps {
  readonly fetchRobotsTxt: (robotsUrl: string) => Promise<string | undefined>;
  readonly fetchPage: (url: string) => Promise<string>;
  readonly archiveRaw: (contentKey: string, html: string) => Promise<void>;
  readonly generateCard: (input: GenerateCardInput) => Promise<GenerateCardResult>;
  readonly updatePost: (postId: string, fields: TransformFields) => Promise<void>;
  readonly enqueueTranslations: (postId: string) => Promise<void>;
  readonly enqueueContentJobs: (postId: string) => Promise<void>;
  readonly mirrorImage: (contentKey: string, imageUrl: string) => Promise<MirrorImageResult>;
}

export interface TransformOutcome {
  readonly degraded: boolean;
  readonly reason?: string;
}

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
      fullText = article?.content ? toExcerpt(article.content, 4000) : undefined;
      excerpt = fullText ? toExcerpt(fullText) : undefined;
      if (!excerpt) reason = 'extraction produced no usable text';
      if (article?.image && !isGenericImage(article.image)) {
        ogImageUrl = article.image;
      }
    } catch (err) {
      reason = `extraction failed: ${errorMessage(err)}`;
    }
  }

  let s3RawKey: string | undefined;
  if (html) {
    s3RawKey = `raw/${input.contentKey}.html`;
    await deps.archiveRaw(input.contentKey, html);
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

  const imageCandidates = [input.imageUrl, ogImageUrl].filter(
    (candidate): candidate is string => !!candidate,
  );

  let mirroredImageUrl: string | undefined;
  let rejectedCandidateCount = 0;

  for (const candidate of imageCandidates) {
    const result = await deps.mirrorImage(input.contentKey, candidate);
    if (result.status === 'ok') {
      mirroredImageUrl = result.url;
      break;
    }
    if (result.status !== 'rejected') break;
    rejectedCandidateCount++;
  }

  const bothCandidatesRejected =
    !!input.imageUrl &&
    rejectedCandidateCount === imageCandidates.length &&
    imageCandidates.length > 0;

  await Promise.all([
    deps.updatePost(input.postId, {
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
    }),
    deps.enqueueTranslations(input.postId),
    deps.enqueueContentJobs(input.postId),
  ]);

  return reason ? { degraded: true, reason } : { degraded: false };
}

export async function isAllowedByRobots(
  url: string,
  fetchRobotsTxt: TransformDeps['fetchRobotsTxt'],
): Promise<boolean> {
  const robotsUrl = new URL('/robots.txt', url).toString();
  const robotsTxt = await fetchRobotsTxt(robotsUrl);
  if (!robotsTxt) return true;
  return robotsParser(robotsUrl, robotsTxt).isAllowed(url, TECHTOK_BOT_USER_AGENT) ?? true;
}
