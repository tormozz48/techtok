export type BuildSource = 'embedded' | 'ota';

export type BuildInfoInput = {
  bundleVersion: string | null | undefined;
  runtimeVersion: string | null | undefined;
  channel: string | null | undefined;
  updateId: string | null | undefined;
  createdAt: Date | null | undefined;
  isEmbeddedLaunch: boolean;
};

export type BuildInfo = {
  source: BuildSource;
  bundleVersion: string;
  runtimeVersion: string;
  channel: string;
  updateId: string;
  publishedAt: string;
};

const UNKNOWN = '—';
const UPDATE_ID_LENGTH = 8;

export function describeBuild(input: BuildInfoInput): BuildInfo {
  const updateId = input.updateId?.trim();

  return {
    source: input.isEmbeddedLaunch || !updateId ? 'embedded' : 'ota',
    bundleVersion: text(input.bundleVersion),
    runtimeVersion: text(input.runtimeVersion),
    channel: text(input.channel),
    updateId: updateId ? updateId.slice(0, UPDATE_ID_LENGTH) : UNKNOWN,
    publishedAt: formatPublishedAt(input.createdAt),
  };
}

function text(value: string | null | undefined): string {
  const trimmed = value?.trim();
  return trimmed ? trimmed : UNKNOWN;
}

function formatPublishedAt(createdAt: Date | null | undefined): string {
  if (!createdAt || Number.isNaN(createdAt.getTime())) return UNKNOWN;
  return createdAt.toISOString().slice(0, 16).replace('T', ' ');
}
