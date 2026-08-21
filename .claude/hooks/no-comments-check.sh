#!/usr/bin/env bash
set -uo pipefail

file=$(node -e 'let d="";process.stdin.on("data",c=>d+=c);process.stdin.on("end",()=>{try{const j=JSON.parse(d);process.stdout.write((j.tool_input&&j.tool_input.file_path)||"")}catch{}})')

[ -n "$file" ] && [ -f "$file" ] || exit 0

case "$file" in
  *.ts|*.tsx|*.js|*.jsx|*.mjs|*.cjs|*.astro) ;;
  *) exit 0 ;;
esac

case "$file" in
  */apps/mobile/android/*|*/apps/mobile/ios/*|*/node_modules/*) exit 0 ;;
esac

root="${CLAUDE_PROJECT_DIR:-.}"
[ -x "$root/node_modules/.bin/tsx" ] || exit 0
[ -f "$root/scripts/checkNoComments.ts" ] || exit 0

if ! output=$(cd "$root" && ./node_modules/.bin/tsx scripts/checkNoComments.ts "$file" 2>&1); then
  {
    echo "Comment policy violation. This repo bans comments in code (CLAUDE.md, 'No comments in code'):"
    echo "$output"
    echo "Delete it. Put the 'what' in names, the 'why' in docs/DESIGN.md's decision log or the commit message."
  } >&2
  exit 2
fi
exit 0
