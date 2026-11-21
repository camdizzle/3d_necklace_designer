// Replaces each font <select> with a list that shows every font name in
// its own lettering (images from public/font-previews/). The <select>
// stays in the page, hidden, so the existing settings code keeps working.

import { OUTLINE_FONTS, SCRIPT_FONTS } from './constants.js';

const preview = (key) => `/font-previews/${key}.svg`;

function groupOf(key) {
  if (OUTLINE_FONTS.includes(key)) return 'Bubble & bold';
  if (SCRIPT_FONTS.includes(key)) return 'Script';
  return 'Classic';
}

const pickers = [];

function closeAll(except) {
  for (const p of pickers) if (p !== except) p.close();
}

export function initFontPickers(ids = ['font-select', 'second-line-font', 'third-line-font']) {
  for (const id of ids) {
    const select = document.getElementById(id);
    if (!select) continue;

    const wrap = document.createElement('div');
    wrap.className = 'font-picker';
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'font-picker-btn';
    btn.setAttribute('aria-haspopup', 'listbox');
    btn.setAttribute('aria-expanded', 'false');
    const list = document.createElement('div');
    list.className = 'font-picker-list';
    list.setAttribute('role', 'listbox');
    list.hidden = true;

    const options = [...select.options];
    const groups = ['Bubble & bold', 'Script', 'Classic'];
    for (const g of groups) {
      const inGroup = options.filter((o) => groupOf(o.value) === g);
      if (!inGroup.length) continue;
      const head = document.createElement('div');
      head.className = 'font-picker-group';
      head.textContent = g;
      list.appendChild(head);
      for (const o of inGroup) {
        const item = document.createElement('button');
        item.type = 'button';
        item.className = 'font-picker-option';
        item.setAttribute('role', 'option');
        item.dataset.value = o.value;
        const label = o.textContent.replace(/\s*✦\s*$/, '');
        item.innerHTML = `<img src="${preview(o.value)}" alt="${label}" loading="lazy">`;
        item.title = label;
        item.addEventListener('click', () => {
          select.value = o.value;
          select.dispatchEvent(new Event('change', { bubbles: true }));
          picker.close();
          btn.focus();
        });
        list.appendChild(item);
      }
    }

    const picker = {
      sync() {
        const label = select.options[select.selectedIndex]?.textContent.replace(/\s*✦\s*$/, '') || '';
        btn.innerHTML = `<img src="${preview(select.value)}" alt="${label}"><span aria-hidden="true">▾</span>`;
        btn.setAttribute('aria-label', `Font: ${label}`);
        list.querySelectorAll('.font-picker-option').forEach((b) => {
          const on = b.dataset.value === select.value;
          b.classList.toggle('active', on);
          b.setAttribute('aria-selected', on ? 'true' : 'false');
        });
      },
      open() {
        closeAll(picker);
        list.hidden = false;
        btn.setAttribute('aria-expanded', 'true');
        list.querySelector('.active')?.scrollIntoView({ block: 'nearest' });
      },
      close() {
        list.hidden = true;
        btn.setAttribute('aria-expanded', 'false');
      }
    };
    pickers.push(picker);

    btn.addEventListener('click', () => (list.hidden ? picker.open() : picker.close()));
    select.addEventListener('change', () => picker.sync());
    select.style.display = 'none';
    select.parentNode.insertBefore(wrap, select.nextSibling);
    wrap.appendChild(btn);
    wrap.appendChild(list);
    picker.sync();
  }

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.font-picker')) closeAll(null);
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeAll(null); });
}

// Call after code changes a select's value without a change event.
export function syncFontPickers() {
  for (const p of pickers) p.sync();
}
