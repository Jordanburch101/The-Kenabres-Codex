import type { GlossaryIndex } from './glossary';
import { resolveTerm } from './glossary';

const ICON_BASE = '/glossary-icons/';

// Escape only bare < and >; leave &entities; intact.
function escapeAngles(s: string): string {
  return s.replace(/<(?![a-z/])/gi, '&lt;');
}

export function renderInline(text: string, index: GlossaryIndex): string {
  // 1) Resolve [[terms]] first (before markdown), replacing with HTML.
  let out = text.replace(/\[\[([^\]]+)\]\]/g, (_m, raw) => {
    const t = resolveTerm(index, raw);
    const icon = t.icon ? `<img class="ic-in" src="${ICON_BASE}${t.icon}" alt="">` : '';
    const attrs = `class="wl" data-cat="${t.category}" data-desc="${t.desc.replace(/"/g, '&quot;')}"`;
    if (t.href) {
      return `<a ${attrs} href="${t.href}" target="_blank" rel="noopener">${icon}${t.display}</a>`;
    }
    return `<span ${attrs}>${icon}${t.display}</span>`;
  });
  // 2) Inline markdown.
  out = out
    .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
    .replace(/(^|[^*])\*([^*]+)\*/g, '$1<i>$2</i>')
    .replace(/`([^`]+)`/g, '<code>$1</code>');
  return escapeAngles(out);
}
