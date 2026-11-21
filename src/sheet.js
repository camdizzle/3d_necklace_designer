// A simple full-screen window used for "Start from an example" and
// "My designs".

const sheet = () => document.getElementById('cs-sheet');

export function openSheet(title, body) {
  const el = sheet();
  if (!el) return;
  document.getElementById('cs-sheet-title').textContent = title;
  const holder = document.getElementById('cs-sheet-body');
  holder.innerHTML = '';
  holder.appendChild(body);
  el.hidden = false;
}

export function closeSheet() {
  const el = sheet();
  if (el) el.hidden = true;
}

export function initSheet() {
  const el = sheet();
  if (!el) return;
  document.getElementById('cs-sheet-close')?.addEventListener('click', closeSheet);
  el.addEventListener('click', (e) => { if (e.target === el) closeSheet(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !el.hidden) closeSheet(); });
}

export function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') node.className = v;
    else if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
    else if (v !== false && v != null) node.setAttribute(k, v);
  }
  for (const c of children.flat()) {
    if (c == null || c === false) continue;
    node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
  }
  return node;
}
