import type { GlossaryIndex } from './glossary';
import { resolveTerm } from './glossary';

const ICON_BASE = '/glossary-icons/';

// Escape bare `<` and `>` in raw authored prose. `&` is left untouched so
// pre-existing entities (&mdash;, &amp;, ...) pass through intact. This must
// run FIRST, before [[term]] resolution or markdown substitution — those are
// the only steps allowed to generate real HTML tags, and running this after
// them would double-escape (or fail to escape) the tags they produce.
function escapeAngleBrackets(s: string): string {
  return s.replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Neutralize markdown-active characters inside an HTML attribute value so the
// later markdown passes (**bold**, *em*, `code`) can't reach into data-desc
// and corrupt it. Browsers decode numeric entities in attribute values, so the
// tooltip text is unchanged.
function escapeAttr(s: string): string {
  return s.replace(/"/g, '&quot;').replace(/\*/g, '&#42;').replace(/`/g, '&#96;');
}

export function renderInline(text: string, index: GlossaryIndex): string {
  // 1) Escape bare angle brackets in the raw input first.
  let out = escapeAngleBrackets(text);

  // 2) Resolve [[terms]] (before markdown), replacing with HTML.
  out = out.replace(/\[\[([^\]]+)\]\]/g, (_m, raw) => {
    const t = resolveTerm(index, raw);
    const icon = t.icon ? `<img class="ic-in" src="${ICON_BASE}${t.icon}" alt="">` : '';
    const attrs = `class="wl" data-cat="${t.category}" data-desc="${escapeAttr(t.desc)}"`;
    if (t.href) {
      return `<a ${attrs} href="${t.href}" target="_blank" rel="noopener">${icon}${t.display}</a>`;
    }
    return `<span ${attrs}>${icon}${t.display}</span>`;
  });

  // 3) Inline markdown.
  out = out
    .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
    .replace(/(^|[^*])\*([^*]+)\*/g, '$1<i>$2</i>')
    .replace(/`([^`]+)`/g, '<code>$1</code>');

  return out;
}
