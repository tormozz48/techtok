import type { Topic } from '@techtok/shared';

export interface UserRecord {
  userId: string;
  topics: Topic[];
  createdAt: string;
  lastSeenAt: string;
}
