#!/usr/bin/env bash
# PostToolUse hook: flag mobile components/screens that lack Storybook coverage.
# Informational only — never blocks. Component check is a direct file-existence
# check; screen check greps src/stories/pages for the `@/app/<route>` import
# every page story uses (see FeedScreen.stories.tsx etc.) so it stays correct
# without a hardcoded route->story name table.
set -uo pipefail

file=$(node -e 'let d="";process.stdin.on("data",c=>d+=c);process.stdin.on("end",()=>{try{const j=JSON.parse(d);process.stdout.write((j.tool_input&&j.tool_input.file_path)||"")}catch{}})')

root="${CLAUDE_PROJECT_DIR:-.}"
mobile_src="$root/apps/mobile/src"

case "$file" in
  "$mobile_src"/components/*.tsx)
    case "$file" in
      *.stories.tsx|*.test.tsx) exit 0 ;;
    esac
    story="${file%.tsx}.stories.tsx"
    if [ ! -f "$story" ]; then
      echo "Storybook sync: ${file#"$root"/} has no matching ${story#"$root"/} — add one (see CLAUDE.md Storybook rule)." >&2
    fi
    ;;
  "$mobile_src"/app/*.tsx)
    case "$file" in
      *.test.tsx) exit 0 ;;
    esac
    base=$(basename "$file")
    [ "$base" = "_layout.tsx" ] && exit 0
    route="${file#"$mobile_src"/app/}"
    route="${route%.tsx}"
    if ! grep -rlF "from '@/app/${route}'" "$mobile_src/stories/pages/" >/dev/null 2>&1; then
      echo "Storybook sync: apps/mobile/src/app/${route}.tsx has no page story importing '@/app/${route}' in apps/mobile/src/stories/pages/ — add or update one (see CLAUDE.md Storybook rule)." >&2
    fi
    ;;
  *) exit 0 ;;
esac
exit 0
