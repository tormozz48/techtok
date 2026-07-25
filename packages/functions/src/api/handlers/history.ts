import { historyQuerySchema, historyResponseSchema } from '@techtok/shared';
import { getUserActivityRepo } from '../../repos';
import { jsonResponse, parseQuery, withDeviceId } from '../lib/http';
import { toHistoryItem } from '../transformers/toHistoryItem';

export const handler = withDeviceId(async (event, deviceId) => {
  const query = parseQuery(event, historyQuerySchema);
  if (!query.ok) return query.response;

  const page = await getUserActivityRepo().queryHistory(deviceId, query.data);

  const body = historyResponseSchema.parse({
    items: page.items.map(toHistoryItem),
    nextCursor: page.nextCursor,
  });

  return jsonResponse(200, body);
});
