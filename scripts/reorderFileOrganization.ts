import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { findOrganizationViolations } from './lib/fileOrganization';
import { reorderTopLevelStatements } from './lib/reorderStatements';

const SCRIPT_KINDS: Record<string, ts.ScriptKind> = {
  '.ts': ts.ScriptKind.TS,
  '.tsx': ts.ScriptKind.TSX,
};

const files = process.argv.slice(2);
if (files.length === 0) {
  console.error('Usage: tsx scripts/reorderFileOrganization.ts <file...>');
  process.exit(1);
}

let changed = 0;
for (const file of files) {
  const scriptKind = SCRIPT_KINDS[path.extname(file)];
  if (!scriptKind) continue;
  if (findOrganizationViolations(file).length === 0) continue;

  const original = readFileSync(file, 'utf8');
  const reordered = reorderTopLevelStatements(scriptKind, original);
  if (reordered === original) continue;

  writeFileSync(file, reordered);
  changed += 1;
  console.log(`reordered ${file}`);
}

console.log(`\n${changed} file(s) reordered.`);
