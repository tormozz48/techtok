import type { Language } from '@techtok/shared';
import type { PostRecord } from '../posts.types';

/** How long an `i18nPending[lang]` marker is trusted before being treated as
 * stale and retried — self-healing against a translate Lambda that crashes
 * before clearing its own marker (an infra failure already goes to the DLQ,
 * but this covers anything that slips past that). Not specified by DESIGN;
 * a deliberate scope choice, comfortably longer than the translate Lambda's
 * own 30s timeout. */
const PENDING_STALE_MS = 10 * 60 * 1000;

/**
 * Whether a post's feed response should trigger an on-demand translation
 * enqueue for `lang` (DESIGN §5.2 step 7 / D22). English never needs
 * translation; an existing translation or a fresh pending marker means one
 * is already in flight or already done.
 */
export function needsTranslation(post: PostRecord, lang: Language, now: Date): boolean {
  if (lang === 'en') return false;
  if (post.i18n[lang]) return false;

  const pendingAt = post.i18nPending[lang];
  if (!pendingAt) return true;

  return now.getTime() - new Date(pendingAt).getTime() > PENDING_STALE_MS;
}
