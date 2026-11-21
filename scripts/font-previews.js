// Writes public/font-previews/<font>.svg: each font's name drawn in that
// font, for the designer's font picker. Reads the same typeface files
// the designer uses. Re-run after adding a font:
//   node scripts/font-previews.js

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { FONTS, FONT_LABELS } from '../src/constants.js';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'public', 'font-previews');
fs.mkdirSync(OUT, { recursive: true });

const SIZE = 100;
const r = (n) => Math.round(n * 10) / 10;

function glyphPath(outline, scale, ox) {
  const t = outline.split(' ');
  const out = [];
  const X = (v) => r(ox + parseFloat(v) * scale);
  const Y = (v) => r(-parseFloat(v) * scale);
  for (let i = 0; i < t.length;) {
    const c = t[i++];
    if (c === 'm') out.push(`M${X(t[i++])} ${Y(t[i++])}`);
    else if (c === 'l') out.push(`L${X(t[i++])} ${Y(t[i++])}`);
    else if (c === 'q') {
      const x = t[i++], y = t[i++], cx = t[i++], cy = t[i++];
      out.push(`Q${X(cx)} ${Y(cy)} ${X(x)} ${Y(y)}`);
    } else if (c === 'b') {
      const x = t[i++], y = t[i++], c1x = t[i++], c1y = t[i++], c2x = t[i++], c2y = t[i++];
      out.push(`C${X(c1x)} ${Y(c1y)} ${X(c2x)} ${Y(c2y)} ${X(x)} ${Y(y)}`);
    } else if (c === 'z') out.push('Z');
  }
  return out.join('');
}

let written = 0;
for (const [key, rel] of Object.entries(FONTS)) {
  const font = JSON.parse(fs.readFileSync(path.join(ROOT, 'public', rel.replace(/^\//, '')), 'utf-8'));
  const scale = SIZE / font.resolution;
  const label = FONT_LABELS[key].replace(/\s*✦\s*$/, '');
  let x = 0;
  const parts = [];
  for (const ch of label) {
    const g = font.glyphs[ch] || font.glyphs['?'];
    if (!g) continue;
    if (g.o) parts.push(glyphPath(g.o, scale, x));
    x += g.ha * scale;
  }
  const top = font.boundingBox.yMax * scale;
  const bottom = -font.boundingBox.yMin * scale;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 ${r(-top)} ${r(x)} ${r(top + bottom)}" role="img" aria-label="${label}"><path fill="#000" d="${parts.join('')}"/></svg>\n`;
  fs.writeFileSync(path.join(OUT, `${key}.svg`), svg);
  written++;
}
console.log(`font-previews: wrote ${written} previews to public/font-previews/`);
