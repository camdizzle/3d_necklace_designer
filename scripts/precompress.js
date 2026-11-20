// Post-build step: write a .gz next to each compressible file in dist/
// so the server can send it without compressing on every request.
import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { fileURLToPath } from 'url';

const DIST = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist');
const EXT = new Set(['.js', '.css', '.json', '.svg', '.stl', '.html']);
let saved = 0;

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) { walk(full); continue; }
    if (!EXT.has(path.extname(entry.name).toLowerCase())) continue;
    const raw = fs.readFileSync(full);
    if (raw.length < 1024) continue;
    const gz = zlib.gzipSync(raw, { level: 9 });
    if (gz.length < raw.length * 0.9) {
      fs.writeFileSync(full + '.gz', gz);
      saved += raw.length - gz.length;
    }
  }
}

if (fs.existsSync(DIST)) {
  walk(DIST);
  console.log(`precompress: saved ${(saved / 1048576).toFixed(1)} MB across dist/`);
}
