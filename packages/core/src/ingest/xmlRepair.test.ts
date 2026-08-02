import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Parser from 'rss-parser';
import { describe, expect, it } from 'vitest';
import { repairFeedXml } from './xmlRepair';

const dirname = path.dirname(fileURLToPath(import.meta.url));
const fixture = (name: string) => path.join(dirname, '__fixtures__', name);

describe('repairFeedXml', () => {
  it('gives a valueless attribute an empty value', () => {
    expect(repairFeedXml('<image rdf:resource/>')).toBe('<image rdf:resource=""/>');
    expect(repairFeedXml('<image rdf:resource></image>')).toBe('<image rdf:resource=""></image>');
  });

  it('repairs a valueless attribute split across lines, as Nature emits it', () => {
    expect(repairFeedXml('<prism:issn rdf:resource\n    />')).toBe(
      '<prism:issn rdf:resource=""\n    />',
    );
  });

  it('repairs only the valueless attribute, leaving its well-formed siblings intact', () => {
    expect(
      repairFeedXml('<media:content url="http://x/a.png" medium isPermaLink=\'false\'/>'),
    ).toBe('<media:content url="http://x/a.png" medium="" isPermaLink=\'false\'/>');
  });

  it('leaves a well-formed tag byte-identical', () => {
    const tag = '<admin:generatorAgent rdf:resource="https://www.nature.com/"/>';
    expect(repairFeedXml(tag)).toBe(tag);
  });

  it('never rewrites text, CDATA, comments or declarations', () => {
    const xml =
      '<?xml version="1.0"?><!-- a > b --><title><![CDATA[5 > 3 and a=b]]></title><!DOCTYPE x>';
    expect(repairFeedXml(xml)).toBe(xml);
  });

  it('does not mistake a ">" inside an attribute value for the end of the tag', () => {
    const tag = '<item title="a > b" rdf:about="http://x"/>';
    expect(repairFeedXml(tag)).toBe(tag);
  });

  it.each(['hn.xml', 'verge.xml', 'ars.xml', 'techcrunch.xml', 'physorg.xml', 'sciencedaily.xml'])(
    'is a no-op on the well-formed %s fixture',
    async (name) => {
      const xml = await readFile(fixture(name), 'utf8');
      expect(repairFeedXml(xml)).toBe(xml);
    },
  );

  it('makes the malformed Nature feed parseable without losing its items', async () => {
    const xml = await readFile(fixture('nature-malformed.xml'), 'utf8');

    // Guards the fixture itself: it must still reproduce the exact sax error
    // seen in production, otherwise this test proves nothing.
    await expect(new Parser().parseString(xml)).rejects.toThrow('Attribute without value');

    const feed = await new Parser().parseString(repairFeedXml(xml));
    expect(feed.items).toHaveLength(2);
    expect(feed.items[0]?.link).toBe('https://www.nature.com/articles/s41586-026-10921-w');
  });
});
