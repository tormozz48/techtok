import { execFileSync } from 'node:child_process';
import { findAnyComments, isAllowedDirective, isSupportedFile } from './lib/comments';

const EXCLUDED_PREFIXES = ['apps/mobile/android/', 'apps/mobile/ios/', 'apps/mobile/assets/'];

const EXCLUDED_FILES = ['apps/mobile/expo-env.d.ts'];

function trackedSourceFiles(): string[] {
  const out = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' });
  return out
    .split('\0')
    .filter(Boolean)
    .filter(isSupportedFile)
    .filter((f) => !EXCLUDED_PREFIXES.some((p) => f.startsWith(p)))
    .filter((f) => !EXCLUDED_FILES.includes(f))
    .filter((f) => !f.includes('node_modules/') && !f.endsWith('sst-env.d.ts'));
}

const files = process.argv.slice(2).filter((a) => !a.startsWith('-'));
const targets = files.length > 0 ? files.filter(isSupportedFile) : trackedSourceFiles();

let violations = 0;
for (const file of targets) {
  for (const hit of findAnyComments(file)) {
    if (isAllowedDirective(hit.text)) continue;
    violations += 1;
    const preview = hit.text.replace(/\s+/g, ' ').slice(0, 90);
    console.log(`${file}:${hit.line}:${hit.column}  ${preview}`);
  }
}

if (violations > 0) {
  console.error(
    `\n${violations} comment(s) found in ${targets.length} file(s). This repo bans code comments — delete them or make the code self-explanatory.`,
  );
  process.exit(1);
}

console.log(`No comments found in ${targets.length} source file(s).`);
