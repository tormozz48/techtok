import type { Language } from '@techtok/shared';
import { selectCardVariant } from '../i18n/selectCardVariant';
import type { ExpoPushMessage } from '../notifications/expoPush';
import type { PostRecord } from '../posts.types';

const DIGEST_DEEP_LINK_SCHEME = 'techtok://';

/**
 * Composes the daily digest push for one user from their top unread cards
 * (already ranked/topic-filtered by `buildFeed`). Returns null when there's
 * nothing unread — no point paging someone about an empty feed. `lang`
 * picks the user's translated title when one exists (D21's digest guard),
 * via the same `selectCardVariant` fallback the feed itself uses.
 */
export function composeDigestMessage(
  pushToken: string,
  unreadItems: PostRecord[],
  lang: Language = 'en',
): ExpoPushMessage | null {
  const [top] = unreadItems;
  if (!top) return null;

  const title =
    unreadItems.length === 1 ? '1 new story waiting' : `${unreadItems.length} new stories waiting`;

  return {
    to: pushToken,
    title,
    body: selectCardVariant(top, lang).cardTitle,
    data: { url: DIGEST_DEEP_LINK_SCHEME },
  };
}
