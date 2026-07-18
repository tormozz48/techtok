---
description: Report progress against the implementation plan and propose the next increment
---

Determine where the project actually stands relative to [docs/IMPLEMENTATION_PLAN.md](../../docs/IMPLEMENTATION_PLAN.md):

1. Read the plan and identify the current phase (first phase whose acceptance criteria are not all met).
2. Verify task/criteria status by inspecting the repository and `git log` — evidence in code and infra, not assumptions. For deploy-dependent criteria you cannot verify locally, mark them "needs manual check" rather than guessing.
3. Report:
   - Current phase and a checklist of its tasks/acceptance criteria: done / pending / needs manual check (with the evidence for each "done").
   - Anything implemented that deviates from DESIGN.md — flag it, don't silently accept it.
4. Propose the smallest useful next increment (one work session), with the files it touches and the acceptance criterion it advances.

Keep the CLAUDE.md Status section in sync: if it's stale relative to what you found, update it as part of this command.
