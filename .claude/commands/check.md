---
description: Run all quality gates (lint, typecheck, test) and fix until green
argument-hint: [package-filter]
---

Run the quality gates in order and fix every failure until each exits 0:

1. `pnpm lint`
2. `pnpm typecheck`
3. `pnpm test`

If `$ARGUMENTS` names a workspace package, scope test/typecheck runs to it with `pnpm --filter <pkg> ...` but still run repo-wide `pnpm lint`.

Rules:
- Read the FULL output of each command; fix all reported errors, not just the first.
- Re-run the same command after fixing; loop until exit code 0. Never report "should be fixed" without a green re-run.
- If a fix introduces new errors, fix those too before finishing.
- If the tooling is not yet wired up (pre-Phase 0 scaffold), say exactly which script is missing instead of inventing substitutes.

Finish with a one-line status per gate.
