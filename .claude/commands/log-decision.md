---
description: Record a new decision in the DESIGN.md decision log
argument-hint: <what was decided and why>
---

Record this decision in the decision log at [docs/DESIGN.md](../../docs/DESIGN.md) §2: $ARGUMENTS

Steps:

1. Read the current decision log table. If the input amends an existing decision (same subject as some D#), update that row in place — change the Choice/Why and note the date — instead of adding a duplicate.
2. Otherwise append a new row with the next D-number: Decision (subject), Choice, Why, Revisit-when. If the input doesn't give enough for all four columns, ask before writing — don't invent rationale.
3. Check §12 (deferred defaults): if this decision resolves one of those open questions, remove or update that row so the two sections never contradict.
4. If the decision invalidates anything in docs/IMPLEMENTATION_PLAN.md or CLAUDE.md (commands, hard rules, phases), update those in the same pass and say what changed.

Do not commit automatically — show a summary of the doc changes instead.
