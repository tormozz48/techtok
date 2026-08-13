import { entitlementResponseSchema } from '@techtok/shared';
import { getUsersRepo } from '../../repos';
import { jsonResponse, withAuth } from '../lib/http';
import { toEntitlementResponse } from '../transformers/toEntitlementResponse';

/**
 * `GET /v1/me/entitlement` (D69/D70) — the single source every paywall
 * surface reads from: current plan, today's quota usage/limits, and when
 * they reset. A plain read (`touch`, not an increment) — quota counters
 * only move via `POST /v1/reads` and `GET /v1/posts/:id/content`.
 */
export const handler = withAuth(async (_event, auth) => {
  const user = await getUsersRepo().touch(auth.userId, { email: auth.email, name: auth.name });
  return jsonResponse(200, entitlementResponseSchema.parse(toEntitlementResponse(user)));
});
