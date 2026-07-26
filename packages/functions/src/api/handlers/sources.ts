import { sourcesResponseSchema } from '@techtok/shared';
import type { APIGatewayProxyHandlerV2 } from 'aws-lambda';
import { getSourcesRepo } from '../../repos';
import { jsonResponse } from '../lib/http';

/** Public catalog, no device id required (like GET /v1/topics) — this is
 * source metadata, not user-specific state. Lets the app populate a mute
 * picker without hardcoding the source list. */
export const handler: APIGatewayProxyHandlerV2 = async () => {
  const enabled = await getSourcesRepo().listEnabled();
  const sources = enabled
    .map((source) => ({ sourceId: source.sourceId, name: source.name }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return jsonResponse(200, sourcesResponseSchema.parse({ sources }));
};
