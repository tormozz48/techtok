import { createDynamoClient, createSourcesRepo, type SourceRecord } from '@techtok/core';
import { requireEnv } from '../env';

export async function handler(): Promise<SourceRecord[]> {
  const repo = createSourcesRepo(createDynamoClient(), requireEnv('SOURCES_TABLE_NAME'));
  return repo.listEnabled();
}
