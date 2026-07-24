import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import * as schemas from '../src/schemas';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SNAPSHOT_PATH = resolve(__dirname, '../schema-snapshot.json');

type JsonSchema = Record<string, unknown>;
type Snapshot = Record<string, JsonSchema>;

/** Every exported `*Schema` zod value in schemas.ts, serialized via zod's own
 * `toJSONSchema` — field names, optionality, primitive/enum shapes. */
export function buildSnapshot(): Snapshot {
  const snapshot: Snapshot = {};
  for (const [name, value] of Object.entries(schemas)) {
    if (!name.endsWith('Schema')) continue;
    if (!(value instanceof z.ZodType)) continue;
    snapshot[name] = z.toJSONSchema(value, { unrepresentable: 'any' }) as JsonSchema;
  }
  return snapshot;
}

function asArray(value: unknown): JsonSchema[] {
  return Array.isArray(value) ? (value as JsonSchema[]) : [];
}

function branchTag(branch: JsonSchema): string | undefined {
  const properties = branch.properties as Record<string, JsonSchema> | undefined;
  const tag = properties?.type?.const;
  return typeof tag === 'string' ? tag : undefined;
}

/** Matches old/new `oneOf`/`anyOf` branches by their discriminator `const`
 * (falling back to position for untagged unions, e.g. `T | null`) so each
 * branch can be diffed against its counterpart rather than compared blind. */
function matchBranches(
  oldBranches: JsonSchema[],
  newBranches: JsonSchema[],
): Array<[JsonSchema, JsonSchema | undefined]> {
  const taggedOld = oldBranches.every((b) => branchTag(b) !== undefined);
  const taggedNew = newBranches.every((b) => branchTag(b) !== undefined);
  if (taggedOld && taggedNew) {
    return oldBranches.map((branch) => {
      const tag = branchTag(branch);
      return [branch, newBranches.find((b) => branchTag(b) === tag)];
    });
  }
  return oldBranches.map((branch, i) => [branch, newBranches[i]]);
}

/** Walks a pair of JSON-schema nodes and collects breaking changes: a
 * removed field, a field that went from required to optional, a field/node
 * whose `type` changed, or a removed enum value. Purely additive changes
 * (new optional field, new enum value, new union branch) are not flagged. */
function diffNode(
  path: string,
  oldNode: JsonSchema | undefined,
  newNode: JsonSchema | undefined,
  breaking: string[],
): void {
  if (!oldNode) return;
  if (!newNode) {
    breaking.push(`${path}: removed`);
    return;
  }

  if (Array.isArray(oldNode.enum)) {
    const newEnumValues = new Set(
      (Array.isArray(newNode.enum) ? (newNode.enum as unknown[]) : []).map(String),
    );
    for (const value of oldNode.enum as unknown[]) {
      if (!newEnumValues.has(String(value)))
        breaking.push(`${path}: enum value ${JSON.stringify(value)} removed`);
    }
  }

  if (oldNode.type !== undefined) {
    const oldType = JSON.stringify(oldNode.type);
    const newType = JSON.stringify(newNode.type);
    if (newNode.type !== undefined && oldType !== newType) {
      breaking.push(`${path}: type changed from ${oldType} to ${newType}`);
    }
  }

  const oldProperties = oldNode.properties as Record<string, JsonSchema> | undefined;
  if (oldProperties) {
    const newProperties = (newNode.properties as Record<string, JsonSchema> | undefined) ?? {};
    const oldRequired = new Set(asArray(oldNode.required as unknown as JsonSchema[]).map(String));
    const newRequired = new Set(asArray(newNode.required as unknown as JsonSchema[]).map(String));
    for (const key of Object.keys(oldProperties)) {
      const childPath = `${path}.${key}`;
      if (!(key in newProperties)) {
        breaking.push(`${childPath}: removed`);
        continue;
      }
      if (oldRequired.has(key) && !newRequired.has(key)) {
        breaking.push(`${childPath}: was required, now optional`);
      }
      diffNode(childPath, oldProperties[key], newProperties[key], breaking);
    }
  }

  if (oldNode.items) {
    diffNode(`${path}[]`, oldNode.items as JsonSchema, newNode.items as JsonSchema, breaking);
  }

  for (const key of ['oneOf', 'anyOf'] as const) {
    const oldBranches = asArray(oldNode[key]);
    if (oldBranches.length === 0) continue;
    const newBranches = asArray(newNode[key]);
    for (const [oldBranch, newBranch] of matchBranches(oldBranches, newBranches)) {
      const tag = branchTag(oldBranch);
      diffNode(tag ? `${path}[${tag}]` : `${path}[${key}]`, oldBranch, newBranch, breaking);
    }
  }
}

/** Diffs a previously-committed snapshot against the current one. Only the
 * committed snapshot's schemas are walked — a schema newly added in `next`
 * that doesn't exist in `previous` is purely additive and never flagged. */
export function diffSnapshots(previous: Snapshot, next: Snapshot): string[] {
  const breaking: string[] = [];
  for (const [name, oldRoot] of Object.entries(previous)) {
    diffNode(name, oldRoot, next[name], breaking);
  }
  return breaking;
}

function main(): void {
  const mode = process.argv[2];
  const current = buildSnapshot();

  if (mode === 'check') {
    if (!existsSync(SNAPSHOT_PATH)) {
      console.error(
        `Missing ${SNAPSHOT_PATH} — run "pnpm --filter @techtok/shared run schema:snapshot" first and commit it.`,
      );
      process.exitCode = 1;
      return;
    }
    const committed = JSON.parse(readFileSync(SNAPSHOT_PATH, 'utf8')) as Snapshot;
    const breaking = diffSnapshots(committed, current);
    if (breaking.length === 0) {
      console.log('Schema snapshot check: no breaking changes.');
      return;
    }
    console.error(
      `Schema snapshot check found ${breaking.length} breaking change(s) vs the committed snapshot:`,
    );
    for (const change of breaking) console.error(`  - ${change}`);
    console.error(
      '\nIf this is intentional, regenerate the snapshot ("pnpm --filter @techtok/shared run schema:snapshot") and commit it — that update is the explicit acknowledgment.',
    );
    process.exitCode = 1;
    return;
  }

  writeFileSync(SNAPSHOT_PATH, `${JSON.stringify(current, null, 2)}\n`);
  console.log(`Wrote ${SNAPSHOT_PATH}`);
}

// Only run when executed directly (`tsx schemaSnapshot.ts`), not when the
// test file imports `buildSnapshot`/`diffSnapshots` from this module.
if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  main();
}
