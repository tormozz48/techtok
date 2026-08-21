import { sourcesResponseSchema } from '@techtok/shared';
import { getSourcesRepo } from '../../repos';
import { jsonResponse, withPublic } from '../lib/http';

export const handler = withPublic(async () => {
  const enabled = await getSourcesRepo().listEnabled();
  const sources = enabled
    .map((source) => ({ sourceId: source.sourceId, name: source.name }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return jsonResponse(200, sourcesResponseSchema.parse({ sources }));
});
