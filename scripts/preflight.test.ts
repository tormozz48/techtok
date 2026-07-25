import { describe, expect, it } from 'vitest';
import { checkReservedKeywords, checkWorkflowYaml, findUnaliasedReservedWords } from './preflight';

describe('findUnaliasedReservedWords', () => {
  it('flags a bare reserved word', () => {
    expect(findUnaliasedReservedWords('SET language = :lang')).toEqual(['language']);
  });

  it('does not flag an aliased reserved word', () => {
    expect(findUnaliasedReservedWords('SET #language = :lang')).toEqual([]);
  });

  it('does not flag structural expression keywords', () => {
    expect(findUnaliasedReservedWords('SET #a = :v REMOVE #b')).toEqual([]);
  });

  it('does not flag if_not_exists/size/etc as attribute references', () => {
    expect(
      findUnaliasedReservedWords(
        'SET #compactLangs = list_append(if_not_exists(#compactLangs, :e), :v)',
      ),
    ).toEqual([]);
  });

  it('flags multiple distinct hits', () => {
    expect(findUnaliasedReservedWords('SET status = :s, #ok = name')).toEqual(['status', 'name']);
  });

  it('does not flag a reserved word used as a value placeholder', () => {
    expect(
      findUnaliasedReservedWords('SET #language = if_not_exists(#language, :language)'),
    ).toEqual([]);
  });

  it('is case-insensitive against the reserved list but reports the original casing', () => {
    expect(findUnaliasedReservedWords('SET Status = :s')).toEqual(['Status']);
  });
});

describe('checkReservedKeywords', () => {
  it('finds an unaliased reserved word inside an UpdateExpression literal', () => {
    const content = "const params = { UpdateExpression: 'SET language = :lang' };";
    expect(checkReservedKeywords('a.ts', content)).toEqual([
      {
        file: 'a.ts',
        message: 'unaliased reserved word "language" in expression: SET language = :lang',
      },
    ]);
  });

  it('reports nothing when every reserved word is aliased', () => {
    const content = "const params = { UpdateExpression: 'SET #language = :lang' };";
    expect(checkReservedKeywords('a.ts', content)).toEqual([]);
  });

  it('reports nothing when the file has no expression literals at all', () => {
    expect(checkReservedKeywords('a.ts', 'export const x = 1;')).toEqual([]);
  });
});

describe('checkWorkflowYaml', () => {
  it('reports nothing for valid YAML', () => {
    expect(
      checkWorkflowYaml(
        'ci.yml',
        'name: CI\non: push\njobs:\n  build:\n    runs-on: ubuntu-latest\n',
      ),
    ).toEqual([]);
  });

  it('reports a finding for invalid YAML', () => {
    const findings = checkWorkflowYaml('ci.yml', 'name: CI\non: [push\njobs: {');
    expect(findings).toHaveLength(1);
    expect(findings[0]?.file).toBe('ci.yml');
    expect(findings[0]?.message).toMatch(/invalid YAML/);
  });
});
