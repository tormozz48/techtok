import type { Language, Topic } from '@techtok/shared';

export interface UserRecord {
  readonly userId: string;
  readonly topics: Topic[];
  readonly createdAt: string;
  readonly lastSeenAt: string;
  readonly language?: Language;
  /** Source ids the user has muted (full-replace, like topics). Absent until
   * the user mutes their first source. */
  readonly mutedSources?: string[];
  /** Implicit per-topic read affinity signal (feed/scoring.ts consumes this
   * as a bounded ranking boost). Absent until the user's first read. */
  readonly topicReads?: Partial<Record<Topic, number>>;
  /** From the Google ID token (D68) — the first personal data this app has
   * ever stored. Kept fresh on every touch, unlike the fields below. */
  readonly email?: string;
  readonly name?: string;
  /** IANA timezone, captured once at sign-in (D68/D69's local-midnight quota
   * reset) — never re-derived from later requests. Falls back to UTC. */
  readonly timezone?: string;
}
