#!/usr/bin/env bash
# PostToolUse hook: auto-format the just-edited file with Biome.
# Silently no-ops until Biome is installed (pre-Phase 0) or for non-code files.
set -uo pipefail

file=$(node -e 'let d="";process.stdin.on("data",c=>d+=c);process.stdin.on("end",()=>{try{const j=JSON.parse(d);process.stdout.write((j.tool_input&&j.tool_input.file_path)||"")}catch{}})')

biome="${CLAUDE_PROJECT_DIR:-.}/node_modules/.bin/biome"
[ -x "$biome" ] || exit 0
[ -f "$file" ] || exit 0

case "$file" in
  *.ts|*.tsx|*.js|*.jsx|*.mjs|*.cjs|*.json|*.jsonc)
    "$biome" check --write "$file" >/dev/null 2>&1 || true
    ;;
esac
exit 0
