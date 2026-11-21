// Build step: turn each chain STL in public/ into a compact mesh file in
// dist/meshes/<slug>.mesh that the designer decodes itself.
//
// Format (all little-endian, then the whole file is gzipped):
//   "CSM1" | uint32 vertexCount | uint32 indexCount
//   | float32[3] min | float32[3] step
//   | uint16[vertexCount*3] quantised positions | uint32[indexCount] indices
// Vertices shared by several triangles are stored once; positions are
// quantised to 1/65535 of the mesh size per axis (about 0.003 mm here).
//
// The file is plain binary (served as application/octet-stream), so no
// web server or proxy can alter it. The designer falls back to the STL
// when the .mesh file is missing (e.g. under `npm run dev`).

import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { fileURLToPath } from 'url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'dist', 'meshes');

export function meshSlug(file) {
  return path.basename(file, path.extname(file)).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}

function readBinarySTL(buf) {
  const triangles = buf.readUInt32LE(80);
  if (84 + triangles * 50 !== buf.length) throw new Error('not a binary STL');
  const pos = new Float32Array(triangles * 9);
  for (let t = 0; t < triangles; t++) {
    const o = 84 + t * 50 + 12; // skip the facet normal
    for (let k = 0; k < 9; k++) pos[t * 9 + k] = buf.readFloatLE(o + k * 4);
  }
  return pos;
}

export function packSTL(buf) {
  const pos = readBinarySTL(buf);
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < pos.length; i++) {
    const a = i % 3;
    if (pos[i] < min[a]) min[a] = pos[i];
    if (pos[i] > max[a]) max[a] = pos[i];
  }
  const step = min.map((m, a) => (max[a] - m) / 65535 || 1);

  const lookup = new Map();
  const verts = [];
  const indices = new Uint32Array(pos.length / 3);
  for (let v = 0; v < pos.length / 3; v++) {
    const q = [0, 1, 2].map((a) => Math.round((pos[v * 3 + a] - min[a]) / step[a]));
    const key = q.join(',');
    let id = lookup.get(key);
    if (id === undefined) {
      id = verts.length / 3;
      verts.push(q[0], q[1], q[2]);
      lookup.set(key, id);
    }
    indices[v] = id;
  }

  const vertexCount = verts.length / 3;
  const header = Buffer.alloc(36);
  header.write('CSM1', 0, 'ascii');
  header.writeUInt32LE(vertexCount, 4);
  header.writeUInt32LE(indices.length, 8);
  min.forEach((m, a) => header.writeFloatLE(m, 12 + a * 4));
  step.forEach((s, a) => header.writeFloatLE(s, 24 + a * 4));
  const positions = Buffer.from(new Uint16Array(verts).buffer);
  const pad = Buffer.alloc((4 - ((36 + positions.length) % 4)) % 4);
  const body = Buffer.concat([header, positions, pad, Buffer.from(indices.buffer)]);
  return zlib.gzipSync(body, { level: 9 });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  fs.mkdirSync(OUT, { recursive: true });
  for (const f of fs.readdirSync(path.join(ROOT, 'public')).filter((f) => f.toLowerCase().endsWith('.stl'))) {
    const src = fs.readFileSync(path.join(ROOT, 'public', f));
    const packed = packSTL(src);
    fs.writeFileSync(path.join(OUT, `${meshSlug(f)}.mesh`), packed);
    console.log(`pack-meshes: ${f} ${(src.length / 1048576).toFixed(1)} MB -> meshes/${meshSlug(f)}.mesh ${(packed.length / 1048576).toFixed(2)} MB`);
  }
}
