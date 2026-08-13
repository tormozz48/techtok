import { getUserActivityRepo, getUsersRepo } from '../../repos';
import { noContent, withAuth } from '../lib/http';

/**
 * `DELETE /v1/me` (D68) — required by Google Play policy for any app with
 * accounts. Deletes the user's profile row and every UserActivity row (reads
 * and bookmarks alike). Idempotent: deleting an already-deleted user is a
 * no-op, not an error.
 */
export const handler = withAuth(async (_event, auth) => {
  await getUserActivityRepo().deleteAllForUser(auth.userId);
  await getUsersRepo().deleteUser(auth.userId);

  return noContent();
});
