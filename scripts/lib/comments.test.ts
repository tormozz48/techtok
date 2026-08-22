import { describe, expect, it } from 'vitest';
import { findAnyComments, isAllowedDirective, isSupportedFile } from './comments';

const texts = (file: string, source: string) => findAnyComments(file, source).map((h) => h.text);

describe('findAnyComments', () => {
  it('finds line, trailing, block and JSDoc comments', () => {
    const hits = findAnyComments(
      'x.ts',
      [
        '// leading',
        'const a = 1; // trailing',
        '/* block */',
        '/** jsdoc */',
        'const b = 2;',
      ].join('\n'),
    );
    expect(hits.map((h) => h.text)).toEqual([
      '// leading',
      '// trailing',
      '/* block */',
      '/** jsdoc */',
    ]);
    expect(hits.map((h) => h.line)).toEqual([1, 2, 3, 4]);
  });

  it('ignores comment-like sequences inside strings, templates and regexes', () => {
    expect(
      texts(
        'x.ts',
        [
          "const url = 'https://example.com/a';",
          'const tpl = `no // comment /* here */`;',
          'const re = /a\\/\\/b/;',
          'const div = 4 / 2 / 1;',
        ].join('\n'),
      ),
    ).toEqual([]);
  });

  it('finds comments inside JSX children and attributes', () => {
    expect(
      texts(
        'x.tsx',
        ['const el = (', '  <View>', '    {/* jsx comment */}', '  </View>', ');'].join('\n'),
      ),
    ).toEqual(['/* jsx comment */']);
  });

  it('finds a comment before the end of file', () => {
    expect(texts('x.ts', 'const a = 1;\n// trailing eof\n')).toEqual(['// trailing eof']);
  });

  it('finds comments in astro frontmatter, template and style blocks', () => {
    const hits = texts(
      'x.astro',
      [
        '---',
        '// frontmatter note',
        'const a = 1;',
        '---',
        '<div>',
        '  <!-- html note -->',
        '</div>',
        '<style>',
        '  /* css note',
        '     continued */',
        '</style>',
      ].join('\n'),
    );
    expect(hits).toEqual([
      '// frontmatter note',
      '<!-- html note -->',
      '/* css note',
      'continued */',
    ]);
  });

  it('does not flag astro template urls or division', () => {
    expect(
      texts(
        'x.astro',
        ['---', "const u = 'https://example.com';", '---', '<a href={u}>x</a>'].join('\n'),
      ),
    ).toEqual([]);
  });
});

describe('isAllowedDirective', () => {
  it('allows tool directives that change build or lint behaviour', () => {
    expect(isAllowedDirective('// biome-ignore lint/style/noNonNullAssertion: reason')).toBe(true);
    expect(isAllowedDirective('/// <reference path="./.sst/platform/config.d.ts" />')).toBe(true);
    expect(isAllowedDirective('// @ts-expect-error narrowing')).toBe(true);
    expect(isAllowedDirective('// @vitest-environment jsdom')).toBe(true);
  });

  it('rejects explanatory prose', () => {
    expect(isAllowedDirective('// this reference is ignored downstream')).toBe(false);
    expect(isAllowedDirective('/** Builds the feed page. */')).toBe(false);
  });
});

describe('isSupportedFile', () => {
  it('covers the script and astro extensions the checker walks', () => {
    for (const f of ['a.ts', 'a.tsx', 'a.js', 'a.jsx', 'a.mjs', 'a.cjs', 'a.astro']) {
      expect(isSupportedFile(f)).toBe(true);
    }
    for (const f of ['a.json', 'a.md', 'a.yml', 'a.sh', 'a.css']) {
      expect(isSupportedFile(f)).toBe(false);
    }
  });
});
