import { readFileSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

export type CommentHit = {
  file: string;
  line: number;
  column: number;
  pos: number;
  end: number;
  text: string;
  kind: 'line' | 'block';
};

const ALLOWED_DIRECTIVES = [
  /^\/\/\/\s*<(reference|amd-)/,
  /\bbiome-ignore\b/,
  /\bts-(expect-error|ignore|nocheck)\b/,
  /\beslint-(disable|enable)\b/,
  /\bprettier-ignore\b/,
  /\b(istanbul|c8|v8)\s+ignore\b/,
  /@(jest|vitest)-environment\b/,
  /@ts-check\b/,
  /^\/\*\*?\s*@type(def)?\s/,
  /\bsourceMappingURL=/,
  /\bwebpackIgnore\b/,
  /\b__PURE__\b/,
];

export function isAllowedDirective(text: string): boolean {
  return ALLOWED_DIRECTIVES.some((re) => re.test(text));
}

const SCRIPT_KINDS: Record<string, ts.ScriptKind> = {
  '.ts': ts.ScriptKind.TS,
  '.tsx': ts.ScriptKind.TSX,
  '.mts': ts.ScriptKind.TS,
  '.cts': ts.ScriptKind.TS,
  '.js': ts.ScriptKind.JS,
  '.jsx': ts.ScriptKind.JSX,
  '.mjs': ts.ScriptKind.JS,
  '.cjs': ts.ScriptKind.JS,
};

export function isSupportedFile(file: string): boolean {
  return path.extname(file) in SCRIPT_KINDS || path.extname(file) === '.astro';
}

const ASTRO_COMMENT_LINE = /^\s*(\/\/|\/\*|\*\/?(?!\/)|<!--|\{\/\*)/;

function findAstroComments(file: string, source?: string): CommentHit[] {
  const text = source ?? readFileSync(file, 'utf8');
  const hits: CommentHit[] = [];
  let offset = 0;
  let inBlock = false;

  for (const [index, raw] of text.split('\n').entries()) {
    const trimmed = raw.trim();
    const opensBlock = /\/\*|<!--/.test(trimmed) && !/\*\/|-->/.test(trimmed);
    if (inBlock || ASTRO_COMMENT_LINE.test(raw)) {
      hits.push({
        file,
        line: index + 1,
        column: raw.length - raw.trimStart().length + 1,
        pos: offset,
        end: offset + raw.length,
        text: trimmed,
        kind: inBlock || opensBlock ? 'block' : 'line',
      });
    }
    if (opensBlock) inBlock = true;
    else if (/\*\/|-->/.test(trimmed)) inBlock = false;
    offset += raw.length + 1;
  }

  return hits;
}

export function findAnyComments(file: string, source?: string): CommentHit[] {
  return path.extname(file) === '.astro'
    ? findAstroComments(file, source)
    : findComments(file, source);
}

function findComments(file: string, source?: string): CommentHit[] {
  const text = source ?? readFileSync(file, 'utf8');
  const scriptKind = SCRIPT_KINDS[path.extname(file)] ?? ts.ScriptKind.TS;
  const sourceFile = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, scriptKind);

  const seen = new Set<number>();
  const hits: CommentHit[] = [];

  const record = (ranges: ts.CommentRange[] | undefined) => {
    for (const range of ranges ?? []) {
      if (seen.has(range.pos)) continue;
      seen.add(range.pos);
      const { line, character } = sourceFile.getLineAndCharacterOfPosition(range.pos);
      hits.push({
        file,
        line: line + 1,
        column: character + 1,
        pos: range.pos,
        end: range.end,
        text: text.slice(range.pos, range.end),
        kind: range.kind === ts.SyntaxKind.SingleLineCommentTrivia ? 'line' : 'block',
      });
    }
  };

  const visit = (node: ts.Node) => {
    record(ts.getLeadingCommentRanges(text, node.getFullStart()));
    record(ts.getTrailingCommentRanges(text, node.getEnd()));
    for (const child of node.getChildren(sourceFile)) visit(child);
  };

  visit(sourceFile);
  record(ts.getLeadingCommentRanges(text, sourceFile.endOfFileToken.getFullStart()));

  return hits.sort((a, b) => a.pos - b.pos);
}
