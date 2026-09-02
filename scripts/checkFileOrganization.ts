import { execFileSync } from 'node:child_process';
import { findOrganizationViolations, isOrganizationCheckedFile } from './lib/fileOrganization';

const CHECKED_PREFIXES = ['packages/', 'apps/'];

const CHECKED_SEGMENT = '/src/';

const EXCLUDED_SUFFIXES = [
  '.stories.tsx',
  '.stories.ts',
  '.test.ts',
  '.test.tsx',
  'sst-env.d.ts',
  'expo-env.d.ts',
];

function trackedSourceFiles(): string[] {
  const out = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' });
  return out
    .split('\0')
    .filter(Boolean)
    .filter(isOrganizationCheckedFile)
    .filter((f) => CHECKED_PREFIXES.some((p) => f.startsWith(p)) && f.includes(CHECKED_SEGMENT))
    .filter((f) => !EXCLUDED_SUFFIXES.some((s) => f.endsWith(s)))
    .filter((f) => !f.includes('node_modules/'));
}

const files = process.argv.slice(2).filter((a) => !a.startsWith('-'));
const targets = files.length > 0 ? files.filter(isOrganizationCheckedFile) : trackedSourceFiles();

let violations = 0;
for (const file of targets) {
  for (const hit of findOrganizationViolations(file)) {
    violations += 1;
    console.log(
      `${file}:${hit.line}  "${hit.name}" (${hit.bucket}) appears after a "${hit.expectedNotBefore}" declaration`,
    );
  }
}

if (violations > 0) {
  console.error(
    `\n${violations} file-organization violation(s) found in ${targets.length} file(s). ` +
      'Order top-level declarations as: constants/types/interfaces, then exported functions/classes, then private (non-exported) functions/classes.',
  );
  process.exit(1);
}

console.log(`File organization OK in ${targets.length} source file(s).`);
