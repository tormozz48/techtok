import { readFileSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

export type Bucket = 'import' | 'top' | 'exported' | 'private' | 'other';

export type ClassifiedStatement = {
  statement: ts.Statement;
  bucket: Bucket;
  name: string;
};

export type OrganizationViolation = {
  file: string;
  line: number;
  name: string;
  bucket: Bucket;
  expectedNotBefore: Bucket;
};

const SCRIPT_KINDS: Record<string, ts.ScriptKind> = {
  '.ts': ts.ScriptKind.TS,
  '.tsx': ts.ScriptKind.TSX,
  '.mts': ts.ScriptKind.TS,
  '.cts': ts.ScriptKind.TS,
};

export function isOrganizationCheckedFile(file: string): boolean {
  if (!(path.extname(file) in SCRIPT_KINDS)) return false;
  if (file.endsWith('.d.ts')) return false;
  return true;
}

const BUCKET_ORDER: Record<Bucket, number> = {
  import: 0,
  top: 1,
  exported: 2,
  private: 3,
  other: 4,
};

function hasExportModifier(node: ts.Node): boolean {
  const modifiers = ts.canHaveModifiers(node) ? ts.getModifiers(node) : undefined;
  return (modifiers ?? []).some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
}

function isFunctionLike(initializer: ts.Expression | undefined): boolean {
  if (!initializer) return false;
  return (
    ts.isArrowFunction(initializer) ||
    ts.isFunctionExpression(initializer) ||
    ts.isClassExpression(initializer)
  );
}

function classifyVariableStatement(node: ts.VariableStatement): Bucket {
  const declarations = node.declarationList.declarations;
  const allFunctions = declarations.every((d) => isFunctionLike(d.initializer));
  if (!allFunctions) return 'top';
  return hasExportModifier(node) ? 'exported' : 'private';
}

function classifyStatement(node: ts.Statement): { bucket: Bucket; name: string } {
  if (ts.isImportDeclaration(node) || ts.isImportEqualsDeclaration(node)) {
    return { bucket: 'import', name: 'import' };
  }
  if (ts.isInterfaceDeclaration(node)) {
    return { bucket: 'top', name: node.name.text };
  }
  if (ts.isTypeAliasDeclaration(node)) {
    return { bucket: 'top', name: node.name.text };
  }
  if (ts.isEnumDeclaration(node)) {
    return { bucket: 'top', name: node.name.text };
  }
  if (ts.isVariableStatement(node)) {
    const first = node.declarationList.declarations[0];
    const name = first && ts.isIdentifier(first.name) ? first.name.text : 'const';
    return { bucket: classifyVariableStatement(node), name };
  }
  if (ts.isFunctionDeclaration(node)) {
    return {
      bucket: hasExportModifier(node) ? 'exported' : 'private',
      name: node.name?.text ?? 'function',
    };
  }
  if (ts.isClassDeclaration(node)) {
    return {
      bucket: hasExportModifier(node) ? 'exported' : 'private',
      name: node.name?.text ?? 'class',
    };
  }
  if (ts.isExportAssignment(node) || ts.isExportDeclaration(node)) {
    return { bucket: 'exported', name: 'export' };
  }
  return { bucket: 'other', name: 'statement' };
}

export function classifyStatements(sourceFile: ts.SourceFile): ClassifiedStatement[] {
  return sourceFile.statements.map((statement) => {
    const { bucket, name } = classifyStatement(statement);
    return { statement, bucket, name };
  });
}

export function findOrganizationViolations(file: string, source?: string): OrganizationViolation[] {
  const text = source ?? readFileSync(file, 'utf8');
  const scriptKind = SCRIPT_KINDS[path.extname(file)] ?? ts.ScriptKind.TS;
  const sourceFile = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, scriptKind);

  const classified = classifyStatements(sourceFile);
  const violations: OrganizationViolation[] = [];
  let maxSeen = 0;

  for (const { statement, bucket, name } of classified) {
    const rank = BUCKET_ORDER[bucket];
    if (rank < maxSeen) {
      const { line } = sourceFile.getLineAndCharacterOfPosition(statement.getStart(sourceFile));
      violations.push({
        file,
        line: line + 1,
        name,
        bucket,
        expectedNotBefore:
          (Object.keys(BUCKET_ORDER) as Bucket[]).find((b) => BUCKET_ORDER[b] === maxSeen) ??
          bucket,
      });
    }
    maxSeen = Math.max(maxSeen, rank);
  }

  return violations;
}
