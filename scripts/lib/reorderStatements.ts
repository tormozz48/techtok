import ts from 'typescript';
import { type Bucket, classifyStatements } from './fileOrganization';

const BUCKET_SEQUENCE: Bucket[] = ['import', 'top', 'exported', 'private', 'other'];

type Piece = {
  text: string;
  hadBlankLineBefore: boolean;
  isFunctionLike: boolean;
  bucket: Bucket;
};

function hadBlankLineBefore(sourceFile: ts.SourceFile, statement: ts.Statement): boolean {
  const leading = sourceFile.text.slice(statement.getFullStart(), statement.getStart(sourceFile));
  return (leading.match(/\n/g) ?? []).length >= 2;
}

function isFunctionLikeStatement(statement: ts.Statement): boolean {
  return ts.isFunctionDeclaration(statement) || ts.isClassDeclaration(statement);
}

export function reorderTopLevelStatements(scriptKind: ts.ScriptKind, source: string): string {
  const sourceFile = ts.createSourceFile(
    'file.ts',
    source,
    ts.ScriptTarget.Latest,
    true,
    scriptKind,
  );
  const classified = classifyStatements(sourceFile);

  const pieces: Piece[] = classified.map(({ statement, bucket }) => ({
    text: statement.getText(sourceFile),
    hadBlankLineBefore: hadBlankLineBefore(sourceFile, statement),
    isFunctionLike: isFunctionLikeStatement(statement),
    bucket,
  }));

  const grouped = BUCKET_SEQUENCE.map((bucket) => pieces.filter((p) => p.bucket === bucket));

  const lines: string[] = [];
  let firstGroupEmitted = false;
  for (const group of grouped) {
    if (group.length === 0) continue;
    if (firstGroupEmitted) lines.push('');
    group.forEach((piece, index) => {
      if (
        index > 0 &&
        (piece.hadBlankLineBefore || (piece.isFunctionLike && group[index - 1]?.isFunctionLike))
      ) {
        lines.push('');
      }
      lines.push(piece.text);
    });
    firstGroupEmitted = true;
  }

  return `${lines.join('\n')}\n`;
}
