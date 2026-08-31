#!/usr/bin/env bash
set -uo pipefail

file=$(node -e 'let d="";process.stdin.on("data",c=>d+=c);process.stdin.on("end",()=>{try{const j=JSON.parse(d);process.stdout.write((j.tool_input&&j.tool_input.file_path)||"")}catch{}})')

[ -n "$file" ] && [ -f "$file" ] || exit 0

case "$file" in
  *.ts|*.tsx) ;;
  *) exit 0 ;;
esac

case "$file" in
  *.test.ts|*.test.tsx|*.stories.ts|*.stories.tsx|*.d.ts) exit 0 ;;
esac

case "$file" in
  */packages/*/src/*|*/apps/*/src/*) ;;
  *) exit 0 ;;
esac

root="${CLAUDE_PROJECT_DIR:-.}"
[ -x "$root/node_modules/.bin/tsx" ] || exit 0
[ -f "$root/scripts/checkFileOrganization.ts" ] || exit 0

if ! output=$(cd "$root" && ./node_modules/.bin/tsx scripts/checkFileOrganization.ts "$file" 2>&1); then
  {
    echo "File-organization policy violation (CLAUDE.md, 'File organization'):"
    echo "$output"
    echo "Order top-level declarations as: constants/types/interfaces, then exported functions/classes, then private (non-exported) functions/classes."
  } >&2
  exit 2
fi
exit 0
