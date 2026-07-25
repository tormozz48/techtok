#!/usr/bin/env bash
# PostToolUse hook: scoped typecheck of the just-edited file's workspace package.
# Informational only — never blocks, and silently no-ops for non-TS files or
# packages without a typecheck script.
set -uo pipefail

file=$(node -e 'let d="";process.stdin.on("data",c=>d+=c);process.stdin.on("end",()=>{try{const j=JSON.parse(d);process.stdout.write((j.tool_input&&j.tool_input.file_path)||"")}catch{}})')

case "$file" in
  *.ts|*.tsx) ;;
  *) exit 0 ;;
esac

root="${CLAUDE_PROJECT_DIR:-.}"
case "$file" in
  "$root"/packages/shared/*) pkg="@techtok/shared" ;;
  "$root"/packages/core/*) pkg="@techtok/core" ;;
  "$root"/packages/functions/*) pkg="@techtok/functions" ;;
  "$root"/packages/e2e/*) pkg="@techtok/e2e" ;;
  "$root"/apps/mobile/*) pkg="mobile" ;;
  *) exit 0 ;;
esac

cd "$root" || exit 0
pnpm --filter "$pkg" run typecheck 2>&1 | tail -30
exit 0
