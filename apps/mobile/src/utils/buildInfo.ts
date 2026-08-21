export type BuildSource = 'embedded' | 'ota';

export type BuildInfoInput = {
  /** `version` from app.json, carried inside the JS bundle — moves with an OTA update. */
  bundleVersion: string | null | undefined;
  /** The runtimeVersion the running bundle was published against. */
  runtimeVersion: string | null | undefined;
  /** EAS Update channel (`preview` / `production`), empty in Expo Go. */
  channel: string | null | undefined;
  /** EAS Update id — null while running the bundle embedded in the APK. */
  updateId: string | null | undefined;
  /** When the running update was published. */
  createdAt: Date | null | undefined;
  isEmbeddedLaunch: boolean;
};

export type BuildInfo = {
  source: BuildSource;
  bundleVersion: string;
  runtimeVersion: string;
  channel: string;
  /** Short form of the update id — enough to compare against `eas update:list`. */
  updateId: string;
  publishedAt: string;
};

const UNKNOWN = '—';
const UPDATE_ID_LENGTH = 8;

function text(value: string | null | undefined): string {
  const trimmed = value?.trim();
  return trimmed ? trimmed : UNKNOWN;
}

/** `YYYY-MM-DD HH:mm` UTC — deterministic, and Intl-free for Hermes. */
function formatPublishedAt(createdAt: Date | null | undefined): string {
  if (!createdAt || Number.isNaN(createdAt.getTime())) return UNKNOWN;
  return createdAt.toISOString().slice(0, 16).replace('T', ' ');
}

export function describeBuild(input: BuildInfoInput): BuildInfo {
  const updateId = input.updateId?.trim();

  return {
    // `isEmbeddedLaunch` is the authoritative signal, but a missing updateId
    // means there is nothing to show either way (Expo Go reports neither).
    source: input.isEmbeddedLaunch || !updateId ? 'embedded' : 'ota',
    bundleVersion: text(input.bundleVersion),
    runtimeVersion: text(input.runtimeVersion),
    channel: text(input.channel),
    updateId: updateId ? updateId.slice(0, UPDATE_ID_LENGTH) : UNKNOWN,
    publishedAt: formatPublishedAt(input.createdAt),
  };
}
