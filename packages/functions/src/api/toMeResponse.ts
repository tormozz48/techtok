import type { UserRecord } from '@techtok/core';
import type { MeResponse } from '@techtok/shared';

export function toMeResponse(user: UserRecord): MeResponse {
  return {
    userId: user.userId,
    topics: user.topics,
    createdAt: user.createdAt,
  };
}
