#!/usr/bin/env bash
# Typechecks sst.config.ts + infra/ against SST's generated platform types.
# That directory (.sst/platform) is gitignored and only exists after a local
# `sst dev`/`sst deploy` run with real AWS credentials, so on a fresh clone
# or in CI (which never has credentials, per CLAUDE.md) this skips cleanly
# instead of failing.
set -euo pipefail

if [ -f ".sst/platform/config.d.ts" ]; then
  npx tsc --noEmit -p tsconfig.infra.json
else
  echo "Skipping infra typecheck: .sst/platform not found yet." >&2
  echo "Run 'pnpm dev' once with AWS credentials configured to generate it, then re-run this." >&2
fi
