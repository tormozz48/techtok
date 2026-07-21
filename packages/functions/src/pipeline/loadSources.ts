import type { SourceRecord } from '@techtok/core';
import { getSourcesRepo } from '../repos';

export async function handler(): Promise<SourceRecord[]> {
  return getSourcesRepo().listEnabled();
}
