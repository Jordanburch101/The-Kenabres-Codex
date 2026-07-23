// Strip the authored inline markup (bold/italic/code + [[glossary]] refs) and
// decode the handful of HTML entities used in build summaries, producing a
// plain-text snippet for directory cards. Mirrors the [[term]] display / no-wiki
// semantics of resolveTerm (glossary.ts) and the markdown subset of inline.ts,
// but emits text instead of HTML.

const ENTITIES: Record<string, string> = {
  '&mdash;': '—',
  '&ndash;': '–',
  '&hellip;': '…',
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
};

export function toPlainText(input: string): string {
  let s = input;

  // [[Term]] / [[Term|Display]] / [[Term|no-wiki]] -> display term.
  // Matches resolveTerm: display = alias unless alias is 'no-wiki'.
  s = s.replace(/\[\[([^\]]+)\]\]/g, (_m, raw: string) => {
    const [term, alias] = raw.split('|').map((x) => x.trim());
    return alias && alias !== 'no-wiki' ? alias : term;
  });

  // Inline markdown: bold before italic (mirrors inline.ts ordering).
  s = s.replace(/\*\*([^*]+)\*\*/g, '$1');
  s = s.replace(/(^|[^*])\*([^*]+)\*/g, '$1$2');
  s = s.replace(/`([^`]+)`/g, '$1');

  // Decode the entities the summaries actually use; leave unknown ones intact.
  s = s.replace(/&[a-zA-Z]+;|&#\d+;/g, (m) => ENTITIES[m] ?? m);

  return s.trim();
}
