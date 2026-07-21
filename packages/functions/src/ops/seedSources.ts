import { Logger } from '@aws-lambda-powertools/logger';
import { FULL_SOURCE_PRESETS } from '@techtok/core';
import { getSourcesRepo } from '../repos';

const logger = new Logger({ serviceName: 'seedSources' });

/**
 * One-off seed for the `Sources` table (DESIGN §2 preset list). Safe to
 * invoke repeatedly: conditional put skips sources that already exist, so a
 * re-run never clobbers live edits (e.g. a source disabled via ops).
 * Not wired to any schedule/route — invoke manually after each deploy via
 * `aws lambda invoke --function-name <fn> out.json`.
 */
export async function handler(): Promise<void> {
  const repo = getSourcesRepo();

  let created = 0;
  for (const source of FULL_SOURCE_PRESETS) {
    if (await repo.putIfNew(source)) created += 1;
  }

  logger.info('sources seeded', { total: FULL_SOURCE_PRESETS.length, created });
}
