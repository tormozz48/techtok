import { type ContentStatusResponse, contentStatusQuerySchema } from '@techtok/shared';
import { getContentJobsRepo } from '../repos';
import { errorResponse, jsonResponse, parseQuery, withDeviceId } from './http';

/** Polls a content-generation job started by `POST .../content` (D27). */
export const handler = withDeviceId(async (event, _deviceId) => {
  const query = parseQuery(event, contentStatusQuerySchema);
  if (!query.ok) return query.response;
  const { jobId } = query.data;

  const job = await getContentJobsRepo().getById(jobId);
  if (!job) {
    return errorResponse(404, 'not_found', `content job ${jobId} not found`);
  }

  const response: ContentStatusResponse = {
    stage: job.stage,
    available: job.available,
    ...(job.available === true
      ? { content: { lang: job.lang, blocks: job.blocks ?? [], figures: job.figures ?? [] } }
      : {}),
    ...(job.available === false && job.reason ? { reason: job.reason } : {}),
  };

  return jsonResponse(200, response);
});
