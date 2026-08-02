/**
 * Last-resort repair for feeds whose XML is *almost* well-formed.
 *
 * Nature's RSS feed (`https://www.nature.com/nature.rss`) intermittently emits
 * an element whose attribute value is null upstream, producing a bare
 * attribute name with no `="value"`:
 *
 * ```xml
 * <image rdf:resource
 * />
 * ```
 *
 * `sax` (via `xml2js`, via `rss-parser`) rejects that with
 * `Attribute without value` and aborts the *whole* document — so a single bad
 * attribute silently cost us every item in that poll, roughly 7 polls out of
 * ~240 over five days. Giving the valueless attribute an empty value is enough
 * to make the document parse; the affected element is one we don't read anyway
 * (the channel-level `<image>`), so an empty value loses nothing.
 *
 * Deliberately only invoked *after* a strict parse has already failed
 * (`ingestSource`), so a well-formed feed is never rewritten and this can't
 * corrupt good input.
 */

/**
 * Matches one tag, skipping comments/CDATA/declarations (`<!...`) and
 * processing instructions (`<?...`). Quoted attribute values are consumed as
 * units so a `>` *inside* a value can't end the match early.
 */
const TAG_RE = /<([A-Za-z_][\w.:-]*)((?:[^>"']|"[^"]*"|'[^']*')*)>/g;

/**
 * Within a tag's attribute section, matches either a complete `name="value"`
 * pair (group 1, left alone) or a bare attribute name (group 2, repaired).
 */
const ATTR_RE = /([A-Za-z_][\w.:-]*)\s*=\s*(?:"[^"]*"|'[^']*')|([A-Za-z_][\w.:-]*)/g;

/** Repairs valueless attributes inside a single tag's attribute section. */
function repairAttributes(attrs: string): string {
  return attrs.replace(ATTR_RE, (match, _paired: string | undefined, bare: string | undefined) =>
    bare === undefined ? match : `${bare}=""`,
  );
}

/**
 * Gives every valueless attribute an empty value, leaving everything else —
 * text, CDATA, comments, well-formed attributes — byte-identical.
 */
export function repairFeedXml(xml: string): string {
  return xml.replace(TAG_RE, (match, tagName: string, attrs: string) => {
    // A self-closing tag keeps its trailing `/`, which is not an attribute.
    const selfClosing = attrs.endsWith('/');
    const attrSection = selfClosing ? attrs.slice(0, -1) : attrs;
    const repaired = repairAttributes(attrSection);
    if (repaired === attrSection) return match;
    return `<${tagName}${repaired}${selfClosing ? '/' : ''}>`;
  });
}
