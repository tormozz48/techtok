import { entitlementResponseSchema } from '@techtok/shared';
import { getUsersRepo } from '../../repos';
import { jsonResponse, withAuth } from '../lib/http';
import { toEntitlementResponse } from '../transformers/toEntitlementResponse';

export const handler = withAuth(async (_event, auth) => {
  const user = await getUsersRepo().touch(auth.userId, { email: auth.email, name: auth.name });
  return jsonResponse(200, entitlementResponseSchema.parse(toEntitlementResponse(user)));
});
