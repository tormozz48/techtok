import { globSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as parseYaml } from 'yaml';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

export type Finding = { file: string; message: string };

const EXPRESSION_RE =
  /(?:UpdateExpression|ProjectionExpression|ConditionExpression|KeyConditionExpression|FilterExpression)\s*:\s*(`[^`]*`|'[^']*'|"[^"]*")/g;

// Not exhaustive (DynamoDB's real reserved-word list runs to 500+): a
// curated subset of words plausible as attribute names in this domain,
// seeded by the reserved-word bugs this repo has actually hit ('status',
// 'transform', 'language').
const RESERVED_WORDS = new Set([
  'language',
  'status',
  'transform',
  'name',
  'data',
  'type',
  'role',
  'count',
  'date',
  'time',
  'timestamp',
  'region',
  'source',
  'text',
  'value',
  'values',
  'key',
  'keys',
  'order',
  'size',
  'zone',
  'password',
  'comment',
  'format',
  'action',
  'module',
  'level',
  'group',
  'groups',
  'view',
  'views',
  'table',
  'item',
  'items',
  'map',
  'list',
  'set',
  'number',
  'year',
  'month',
  'day',
  'hour',
  'minute',
  'second',
  'index',
  'resource',
  'path',
]);

// Structural expression syntax, not attribute-name references — must not
// be flagged even though some (e.g. SET) are themselves reserved words.
const EXPRESSION_KEYWORDS = new Set([
  'SET',
  'REMOVE',
  'ADD',
  'DELETE',
  'AND',
  'OR',
  'NOT',
  'IN',
  'BETWEEN',
  'WITH',
  'if_not_exists',
  'list_append',
  'attribute_exists',
  'attribute_not_exists',
  'begins_with',
  'contains',
  'size',
]);

const WORD_RE = /([#:]?)\b([a-zA-Z_][a-zA-Z0-9_]*)\b/g;

/** Reserved-word tokens in a DynamoDB expression string that aren't aliased
 * with a leading '#'. A leading ':' marks an ExpressionAttributeValues
 * placeholder (e.g. ':status') rather than an attribute-name reference, so
 * those are skipped too. `size`/`if_not_exists`/etc are structural
 * expression syntax, not attribute references, so are never flagged. */
export function findUnaliasedReservedWords(expression: string): string[] {
  const hits: string[] = [];
  for (const match of expression.matchAll(WORD_RE)) {
    const [, prefix, word] = match;
    if (prefix === '#' || prefix === ':' || !word) continue;
    if (EXPRESSION_KEYWORDS.has(word)) continue;
    if (RESERVED_WORDS.has(word.toLowerCase())) hits.push(word);
  }
  return hits;
}

/** Scan a TS source file's DynamoDB expression string literals for
 * reserved-keyword attribute names missing an ExpressionAttributeNames
 * alias (the class of bug that 500'd GET /v1/me live — see D-era
 * 'language' incident in CLAUDE.md's Schema & Data Migrations section). */
export function checkReservedKeywords(file: string, content: string): Finding[] {
  const findings: Finding[] = [];
  for (const match of content.matchAll(EXPRESSION_RE)) {
    const rawLiteral = match[1] ?? '';
    const expression = rawLiteral.slice(1, -1);
    const hits = findUnaliasedReservedWords(expression);
    for (const hit of hits) {
      findings.push({
        file,
        message: `unaliased reserved word "${hit}" in expression: ${expression.trim()}`,
      });
    }
  }
  return findings;
}

/** Parse a GitHub Actions workflow file and report a finding if it's not
 * valid YAML — a bad workflow file otherwise only surfaces once GitHub
 * itself refuses to run it. */
export function checkWorkflowYaml(file: string, content: string): Finding[] {
  try {
    parseYaml(content);
    return [];
  } catch (error) {
    return [{ file, message: `invalid YAML: ${(error as Error).message}` }];
  }
}

function readSourceFiles(): { file: string; content: string }[] {
  const paths = globSync('packages/{core,functions}/src/**/*.ts', { cwd: ROOT }).filter(
    (path) => !path.endsWith('.test.ts'),
  );
  return paths.map((path) => ({ file: path, content: readFileSync(resolve(ROOT, path), 'utf8') }));
}

function readWorkflowFiles(): { file: string; content: string }[] {
  const paths = globSync('.github/workflows/*.{yml,yaml}', { cwd: ROOT });
  return paths.map((path) => ({ file: path, content: readFileSync(resolve(ROOT, path), 'utf8') }));
}

function main(): void {
  const findings: Finding[] = [
    ...readSourceFiles().flatMap(({ file, content }) => checkReservedKeywords(file, content)),
    ...readWorkflowFiles().flatMap(({ file, content }) => checkWorkflowYaml(file, content)),
  ];

  console.log(
    'Note: this preflight does not check live schema-vs-data drift (e.g. a narrowed zod ' +
      'schema against rows already in a deployed table) — that needs AWS credentials this ' +
      'script does not assume. Count affected rows manually per the Schema & Data ' +
      'Migrations rule in CLAUDE.md before narrowing a schema.',
  );

  if (findings.length === 0) {
    console.log('preflight: no reserved-keyword or workflow-YAML issues found.');
    return;
  }

  console.error(`preflight: ${findings.length} issue(s) found:\n`);
  for (const finding of findings) {
    console.error(`  ${finding.file}: ${finding.message}`);
  }
  process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  main();
}
