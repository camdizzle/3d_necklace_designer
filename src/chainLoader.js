import * as THREE from 'three';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';
import { gunzipSync } from 'three/addons/libs/fflate.module.js';
import { MATERIALS } from './constants.js';
import { createMaterial } from './pendantGenerator.js';

function findChainAttachPoint(geometry) {
  const pos = geometry.attributes.position;
  const count = pos.count;

  const xTolerance = 12;
  const yVals = [];

  for (let i = 0; i < count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    if (Math.abs(x) < xTolerance) {
      yVals.push(y);
    }
  }
  yVals.sort((a, b) => a - b);

  let maxGap = 0, gapStart = 0, gapEnd = 0;
  for (let i = 1; i < yVals.length; i++) {
    const gap = yVals[i] - yVals[i - 1];
    if (gap > maxGap) {
      maxGap = gap;
      gapStart = yVals[i - 1];
      gapEnd = yVals[i];
    }
  }

  const yTolerance = Math.max(2, maxGap * 0.05);
  let xSum = 0, xCount = 0;
  for (let i = 0; i < count; i++) {
    const y = pos.getY(i);
    if (Math.abs(y - gapEnd) < yTolerance) {
      xSum += pos.getX(i);
      xCount++;
    }
  }
  const attachX = xCount > 0 ? xSum / xCount : 0;

  // Detect bail height: scan vertices above gapEnd and find where
  // vertex density jumps (bail → chain body transition).
  const aboveGap = yVals.filter(y => y >= gapEnd);
  const binSize = 2;
  const bins = {};
  aboveGap.forEach(y => {
    const bin = Math.floor((y - gapEnd) / binSize);
    bins[bin] = (bins[bin] || 0) + 1;
  });
  const binKeys = Object.keys(bins).map(Number).sort((a, b) => a - b);
  let bailHeight = 10;
  for (let i = 1; i < binKeys.length; i++) {
    const prev = bins[binKeys[i - 1]] || 0;
    const curr = bins[binKeys[i]] || 0;
    if (curr > prev * 5 && curr > 500) {
      bailHeight = binKeys[i] * binSize;
      break;
    }
  }

  const bailZVals = [];
  const bailXVals = [];
  for (let i = 0; i < count; i++) {
    const y = pos.getY(i);
    const x = pos.getX(i);
    if (y >= gapEnd && y <= gapEnd + bailHeight && Math.abs(x) < xTolerance) {
      bailZVals.push(pos.getZ(i));
    }
    if (y >= gapEnd && y <= gapEnd + bailHeight && Math.abs(x) < 30) {
      bailXVals.push(x);
    }
  }
  const bailZCenter = bailZVals.length > 0
    ? (Math.min(...bailZVals) + Math.max(...bailZVals)) / 2 : 0;
  const bailXCenter = bailXVals.length > 0
    ? (Math.min(...bailXVals) + Math.max(...bailXVals)) / 2 : 0;

  return {
    attachPoint: new THREE.Vector3(attachX, gapEnd, 0),
    innerTopY: gapEnd,
    innerBottomY: gapStart,
    bailHeight,
    attachX,
    bailZCenter,
    bailXCenter
  };
}

// Chain meshes: a compact .mesh file built by scripts/pack-meshes.js
// (about 0.7-0.9 MB) with the original STL (6-7 MB) as a fallback.
const CHAIN_MODELS = {
  cuban: { mesh: '/meshes/chain_loop.mesh', stl: '/chain_loop.stl' },
  'twisted-star': { mesh: '/meshes/twisted_star_chain.mesh', stl: '/Twisted Star Chain.stl' }
};

const CHAIN_ROTATIONS = {
};

// Decode a .mesh file (see scripts/pack-meshes.js) into the same
// unindexed geometry the STL loader produces, so lighting and the
// attach-point search behave exactly as with the STL.
export function decodeMesh(arrayBuffer) {
  let bytes = new Uint8Array(arrayBuffer);
  if (bytes[0] === 0x1f && bytes[1] === 0x8b) bytes = gunzipSync(bytes);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const magic = String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]);
  if (magic !== 'CSM1') throw new Error('Not a chain mesh file');
  const vertexCount = view.getUint32(4, true);
  const indexCount = view.getUint32(8, true);
  const min = [0, 1, 2].map((a) => view.getFloat32(12 + a * 4, true));
  const step = [0, 1, 2].map((a) => view.getFloat32(24 + a * 4, true));
  let offset = 36;
  const q = new Uint16Array(bytes.slice(offset, offset + vertexCount * 6).buffer);
  offset += vertexCount * 6;
  offset += (4 - (offset % 4)) % 4;
  const indices = new Uint32Array(bytes.slice(offset, offset + indexCount * 4).buffer);
  if (indices.length !== indexCount) throw new Error('Chain mesh file is truncated');

  const positions = new Float32Array(indexCount * 3);
  for (let i = 0; i < indexCount; i++) {
    const v = indices[i] * 3;
    positions[i * 3] = min[0] + q[v] * step[0];
    positions[i * 3 + 1] = min[1] + q[v + 1] * step[1];
    positions[i * 3 + 2] = min[2] + q[v + 2] * step[2];
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  return geometry;
}

async function fetchChainGeometry(chainType) {
  const model = CHAIN_MODELS[chainType] || CHAIN_MODELS.cuban;
  try {
    const res = await fetch(encodeURI(model.mesh));
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return decodeMesh(await res.arrayBuffer());
  } catch (err) {
    console.warn(`Compact chain mesh unavailable (${err.message}); loading the STL instead.`);
    return new STLLoader().loadAsync(encodeURI(model.stl));
  }
}

export async function loadChain(materialKey = 'gold', chainType = 'cuban') {
  const geometry = await fetchChainGeometry(chainType);
  geometry.computeVertexNormals();
  geometry.center();

  const rotation = CHAIN_ROTATIONS[chainType];
  if (rotation) {
    geometry.rotateZ(rotation);
    geometry.center();
  }

  let attach = findChainAttachPoint(geometry);

  if (Math.abs(attach.attachX) > 0.01) {
    geometry.translate(-attach.attachX, 0, 0);
    attach = findChainAttachPoint(geometry);
  }

  const mat = MATERIALS[materialKey] || MATERIALS.gold;
  const material = new THREE.MeshStandardMaterial({
    color: mat.color,
    metalness: mat.metalness,
    roughness: mat.roughness,
    envMapIntensity: mat.envMapIntensity
  });

  const mesh = new THREE.Mesh(geometry, material);

  const box = new THREE.Box3().setFromBufferAttribute(geometry.attributes.position);
  const size = box.getSize(new THREE.Vector3());

  return {
    mesh,
    geometry,
    size,
    attachPoint: attach.attachPoint,
    innerTopY: attach.innerTopY,
    innerBottomY: attach.innerBottomY,
    bailHeight: attach.bailHeight,
    chainThickness: size.z,
    bailZCenter: attach.bailZCenter,
    bailXCenter: attach.bailXCenter
  };
}

export function updateChainMaterial(mesh, materialKey) {
  const mat = MATERIALS[materialKey];
  mesh.material.color.setHex(mat.color);
  mesh.material.metalness = mat.metalness;
  mesh.material.roughness = mat.roughness;
  mesh.material.envMapIntensity = mat.envMapIntensity;
  mesh.material.needsUpdate = true;
}
