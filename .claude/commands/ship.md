---
description: Run quality gates, commit, push, and print a PR compare link
argument-hint: [commit message]
---

Finish out the current change and get it ready for review:

1. Run `/check` (lint, typecheck, test — fix until every gate is green). For any `apps/mobile` change, also run a Metro bundle check.
2. Review `git status`/`git diff` for what's staged vs. unstaged; stage only the files relevant to this change.
3. Commit with a conventional-commit message (`feat:`/`fix:`/`docs:`/`chore:`/`test:`/`refactor:`). Use `$ARGUMENTS` as the message if given, otherwise draft one from the diff.
4. Push the current branch (`git push -u origin <branch>` if it has no upstream yet).
5. Do NOT run `gh pr create` — see the Git & PR Workflow section in CLAUDE.md (the authenticated `gh` account is read-only). Instead print:
   - A compare link: `https://github.com/tormozz48/techtok/compare/main...<branch>?expand=1`
   - A suggested PR title and body (summary + test plan) the maintainer can paste in.

If any gate can't be made green, stop and report exactly what's failing instead of pushing partial work.
