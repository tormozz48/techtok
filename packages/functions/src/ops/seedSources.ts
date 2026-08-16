import { Logger } from '@aws-lambda-powertools/logger';
import { sourcePresetsForStage } from '@techtok/core';
import { getSourcesRepo } from '../repos';

const logger = new Logger({ serviceName: 'seedSources' });

/**
 * One-off seed for the `Sources` table (DESIGN §2 preset list). Safe to
 * invoke repeatedly: conditional put skips sources that already exist, so a
 * re-run never clobbers live edits (e.g. a source disabled via ops).
 * Not wired to any schedule/route — invoke manually after each deploy via
 * `aws lambda invoke --function-name <fn> out.json`.
 *
 * Which sources start out `enabled` is stage-dependent — non-production stages
 * get a deliberately small subset, see `sourcePresetsForStage`. Because the
 * put is conditional, this only governs a *freshly seeded* table; an existing
 * stage's enablement stays whatever the table already says.
 */
export async function handler(): Promise<void> {
  const repo = getSourcesRepo();
  const stage = process.env.STAGE ?? 'dev';
  const presets = sourcePresetsForStage(stage);

  let created = 0;
  for (const source of presets) {
    if (await repo.putIfNew(source)) created += 1;
  }

  logger.info('sources seeded', {
    stage,
    total: presets.length,
    enabled: presets.filter((s) => s.enabled).length,
    created,
  });
}
