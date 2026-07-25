const REPO_URL = 'https://github.com/tormozz48/techtok';

export const GITHUB_REPO_URL = REPO_URL;
export const RELEASES_URL = `${REPO_URL}/releases`;

/**
 * GitHub's `releases/latest` alias only ever resolves to the newest
 * *non-prerelease* release (.github/workflows/mobile-build.yml, D39) — so
 * this URL is permanent and never needs to change as new builds ship. Both
 * the download button and the QR code point at it directly.
 */
export const APK_DOWNLOAD_URL = `${RELEASES_URL}/latest/download/techtok.apk`;
