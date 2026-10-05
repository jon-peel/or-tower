/** Tiny element helper: h('div.a.b', 'text') or h('div', {}, child1, child2). */
export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K | `${K}.${string}`,
  attrs: Record<string, string> | string = {},
  ...children: (Node | string)[]
): HTMLElementTagNameMap[K] {
  const [name, ...classes] = tag.split('.');
  const el = document.createElement(name as K);
  if (classes.length) el.className = classes.join(' ');
  if (typeof attrs === 'string') el.textContent = attrs;
  else for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  el.append(...children);
  return el;
}
