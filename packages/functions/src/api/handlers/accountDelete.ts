import { getUserActivityRepo, getUsersRepo } from '../../repos';
import { noContent, withAuth } from '../lib/http';

export const handler = withAuth(async (_event, auth) => {
  await getUserActivityRepo().deleteAllForUser(auth.userId);
  await getUsersRepo().deleteUser(auth.userId);

  return noContent();
});
