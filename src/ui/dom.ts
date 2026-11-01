// Küçük DOM yardımcısı: h('div.class', { onclick }, [çocuklar])

type Child = Node | string | number | null | undefined | false;
type Attrs = Record<string, unknown>;

export function h(sel: string, attrs?: Attrs | Child[] | Child, children?: Child[] | Child): HTMLElement {
  const [tag, ...classes] = sel.split('.');
  const el = document.createElement(tag || 'div');
  if (classes.length) el.className = classes.join(' ');
  let a: Attrs = {};
  let kids: Child[] | Child = children;
  if (Array.isArray(attrs) || attrs instanceof Node || typeof attrs !== 'object' || attrs === null) kids = attrs as Child[] | Child;
  else a = attrs;
  for (const [k, v] of Object.entries(a)) {
    if (v === undefined || v === null || v === false) continue;
    if (k.startsWith('on') && typeof v === 'function') {
      el.addEventListener(k.slice(2), v as EventListener);
    } else if (k === 'class') {
      el.className += (el.className ? ' ' : '') + String(v);
    } else if (k === 'style' && typeof v === 'object') {
      Object.assign(el.style, v);
    } else if (k === 'html') {
      el.innerHTML = String(v);
    } else if (v === true) {
      el.setAttribute(k, '');
    } else {
      el.setAttribute(k, String(v));
    }
  }
  append(el, kids);
  return el;
}

function append(el: HTMLElement, kids: Child[] | Child): void {
  if (kids === undefined || kids === null || kids === false) return;
  if (Array.isArray(kids)) {
    for (const k of kids) append(el, k);
    return;
  }
  el.append(kids instanceof Node ? kids : document.createTextNode(String(kids)));
}

/** SVG metnini öğeye çevirir */
export function svg(markup: string): HTMLElement {
  const t = document.createElement('span');
  t.style.display = 'inline-flex';
  t.innerHTML = markup;
  return t;
}

export function clear(el: HTMLElement): void {
  while (el.firstChild) el.removeChild(el.firstChild);
}
