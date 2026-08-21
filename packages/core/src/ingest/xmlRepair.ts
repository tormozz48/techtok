const TAG_RE = /<([A-Za-z_][\w.:-]*)((?:[^>"']|"[^"]*"|'[^']*')*)>/g;

const ATTR_RE = /([A-Za-z_][\w.:-]*)\s*=\s*(?:"[^"]*"|'[^']*')|([A-Za-z_][\w.:-]*)/g;

function repairAttributes(attrs: string): string {
  return attrs.replace(ATTR_RE, (match, _paired: string | undefined, bare: string | undefined) =>
    bare === undefined ? match : `${bare}=""`,
  );
}

export function repairFeedXml(xml: string): string {
  return xml.replace(TAG_RE, (match, tagName: string, attrs: string) => {
    const selfClosing = attrs.endsWith('/');
    const attrSection = selfClosing ? attrs.slice(0, -1) : attrs;
    const repaired = repairAttributes(attrSection);
    if (repaired === attrSection) return match;
    return `<${tagName}${repaired}${selfClosing ? '/' : ''}>`;
  });
}
