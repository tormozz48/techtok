import { Logger } from '@aws-lambda-powertools/logger';
import { sourcePresetsForStage } from '@techtok/core';
import { getSourcesRepo } from '../repos';

const logger = new Logger({ serviceName: 'seedSources' });

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
