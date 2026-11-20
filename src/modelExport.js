// Model export: builds the printable model from the live scene and
// turns it into STL (single body) or 3MF (one part per colour, so
// multi-colour printers can assign a filament to each part).

import * as THREE from 'three';
import { STLExporter } from 'three/addons/exporters/STLExporter.js';
import { zipSync, strToU8 } from 'three/addons/libs/fflate.module.js';

export function buildExportGroup(chainMesh, pendantGroup) {
  const group = new THREE.Group();
  if (chainMesh && chainMesh.visible) {
    const chain = chainMesh.clone();
    chain.userData.exportPart = 'Chain';
    group.add(chain);
  }
  const pendant = pendantGroup.clone();
  pendant.userData.exportPart = 'Pendant';
  group.add(pendant);
  group.updateMatrixWorld(true);
  return group;
}

export function exportSTLBuffer(group) {
  const result = new STLExporter().parse(group, { binary: true });
  return result.buffer ? result.buffer : result;
}

function partNameFor(mesh) {
  let node = mesh;
  while (node) {
    if (node.userData && node.userData.exportPart) return node.userData.exportPart;
    node = node.parent;
  }
  return 'Part';
}

const fmt = (n) => {
  const s = n.toFixed(4);
  return s.indexOf('.') === -1 ? s : s.replace(/\.?0+$/, '') || '0';
};

// Collect triangles into one welded mesh per (part, colour) pair.
function collectParts(group) {
  const parts = new Map();
  const v = new THREE.Vector3();

  group.traverse((mesh) => {
    if (!mesh.isMesh || !mesh.geometry) return;
    const pos = mesh.geometry.attributes.position;
    if (!pos) return;
    const color = '#' + (mesh.material?.color ? mesh.material.color.getHexString() : 'cccccc').toUpperCase();
    const key = `${partNameFor(mesh)}|${color}`;
    let part = parts.get(key);
    if (!part) {
      part = { name: partNameFor(mesh), color, vertices: [], triangles: [], lookup: new Map() };
      parts.set(key, part);
    }

    const index = mesh.geometry.index;
    const count = index ? index.count : pos.count;
    const tri = [0, 0, 0];
    for (let i = 0; i < count; i++) {
      const vi = index ? index.getX(i) : i;
      v.fromBufferAttribute(pos, vi).applyMatrix4(mesh.matrixWorld);
      const text = `x="${fmt(v.x)}" y="${fmt(v.y)}" z="${fmt(v.z)}"`;
      let id = part.lookup.get(text);
      if (id === undefined) {
        id = part.vertices.length;
        part.vertices.push(text);
        part.lookup.set(text, id);
      }
      tri[i % 3] = id;
      if (i % 3 === 2 && tri[0] !== tri[1] && tri[1] !== tri[2] && tri[0] !== tri[2]) {
        part.triangles.push(`<triangle v1="${tri[0]}" v2="${tri[1]}" v3="${tri[2]}"/>`);
      }
    }
  });

  return [...parts.values()].filter((p) => p.triangles.length > 0);
}

const xmlEscape = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

export function export3MFBuffer(group, title = 'Chain Studio design') {
  const parts = collectParts(group);
  const colors = [...new Set(parts.map((p) => p.color))];

  const chunks = [
    '<?xml version="1.0" encoding="UTF-8"?>\n',
    '<model unit="millimeter" xml:lang="en-US" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">\n',
    `<metadata name="Title">${xmlEscape(title)}</metadata>\n`,
    '<metadata name="Application">Chain Studio</metadata>\n',
    '<resources>\n<basematerials id="1">\n',
    ...colors.map((c) => `<base name="${c}" displaycolor="${c}FF"/>\n`),
    '</basematerials>\n'
  ];

  const nameCounts = {};
  parts.forEach((part, i) => {
    nameCounts[part.name] = (nameCounts[part.name] || 0) + 1;
    const name = `${part.name} ${nameCounts[part.name]} ${part.color}`;
    chunks.push(
      `<object id="${i + 2}" type="model" name="${xmlEscape(name)}" pid="1" pindex="${colors.indexOf(part.color)}">\n<mesh>\n<vertices>\n`,
      part.vertices.map((t) => `<vertex ${t}/>`).join('\n'),
      '\n</vertices>\n<triangles>\n',
      part.triangles.join('\n'),
      '\n</triangles>\n</mesh>\n</object>\n'
    );
  });

  chunks.push('</resources>\n<build>\n');
  parts.forEach((_, i) => chunks.push(`<item objectid="${i + 2}"/>\n`));
  chunks.push('</build>\n</model>\n');

  const contentTypes =
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
    '<Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/>' +
    '</Types>';
  const rels =
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Target="/3D/3dmodel.model" Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/>' +
    '</Relationships>';

  const zipped = zipSync({
    '[Content_Types].xml': strToU8(contentTypes),
    '_rels/.rels': strToU8(rels),
    '3D/3dmodel.model': strToU8(chunks.join(''))
  }, { level: 6 });
  return zipped.buffer.slice(zipped.byteOffset, zipped.byteOffset + zipped.byteLength);
}

export function exportModel(group, format, title) {
  return format === '3mf' ? export3MFBuffer(group, title) : exportSTLBuffer(group);
}

// Upload a model as raw binary. STL compresses well, so gzip it in the
// browser when the platform supports it; 3MF is already a zip.
export async function uploadModel(buffer, format) {
  let body = new Blob([buffer]);
  const headers = { 'Content-Type': 'application/octet-stream' };
  if (format !== '3mf' && typeof CompressionStream === 'function') {
    try {
      body = await new Response(body.stream().pipeThrough(new CompressionStream('gzip'))).blob();
      headers['Content-Encoding'] = 'gzip';
    } catch {
      body = new Blob([buffer]);
    }
  }
  const res = await fetch(`/api/upload-model?format=${format}`, { method: 'POST', headers, body });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Upload failed');
  }
  return (await res.json()).uploadId;
}

export function downloadBuffer(buffer, filename) {
  const url = URL.createObjectURL(new Blob([buffer], { type: 'application/octet-stream' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Rough print-feasibility checks. These are guidance for FDM printing,
// not guarantees — they flag the settings most likely to print badly.
export function printabilityWarnings(state, dims) {
  const warnings = [];
  const scale = state.pendantScale || 1;
  const lines = [
    [state.text, state.textSize, state.extrudeDepth],
    [state.secondLineText, state.secondLineSize, state.secondLineExtrudeDepth],
    [state.thirdLineText, state.thirdLineSize, state.thirdLineExtrudeDepth]
  ].filter(([text]) => text && String(text).trim());

  if (lines.some(([, size]) => size * scale < 8)) {
    warnings.push('Some lettering is under about 8 mm tall. Small letters can lose detail when printed.');
  }
  if (lines.some(([, , depth]) => depth * scale < 1)) {
    warnings.push('Some lettering is under 1 mm thick and may be fragile.');
  }
  if (state.pendantShape === 'outline') {
    if (state.outlineWidth * scale < 1.5) {
      warnings.push('The outline around the letters is under 1.5 mm wide and may break.');
    }
    if (state.outlineBaseDepth * scale < 2) {
      warnings.push('The pendant base is under 2 mm thick and may flex or snap.');
    }
  } else if (state.plateThickness * scale < 2) {
    warnings.push('The pendant plate is under 2 mm thick and may flex or snap.');
  }
  if (dims && Math.max(dims.width, dims.height) > 180) {
    warnings.push('The pendant is over 180 mm across, which is larger than many home printers can make in one piece.');
  }
  if (dims && Math.max(dims.width, dims.height) < 25) {
    warnings.push('The pendant is under 25 mm across. Fine details will be hard to print at this size.');
  }
  return warnings;
}
