import type { Language, Topic } from '@techtok/shared';
import type { Entitlement, Quota } from './entitlement/entitlement.types';

export interface UserRecord {
  readonly userId: string;
  readonly topics: Topic[];
  readonly createdAt: string;
  readonly lastSeenAt: string;
  readonly language?: Language;
  readonly mutedSources?: string[];
  readonly topicReads?: Partial<Record<Topic, number>>;
  readonly email?: string;
  readonly name?: string;
  readonly timezone?: string;
  readonly entitlement?: Entitlement;
  readonly quota?: Quota;
}
