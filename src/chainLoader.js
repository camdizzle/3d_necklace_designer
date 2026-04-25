import * as THREE from 'three';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';
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

  return {
    attachPoint: new THREE.Vector3(attachX, gapEnd, 0),
    innerTopY: gapEnd,
    innerBottomY: gapStart,
    bailHeight,
    attachX
  };
}

const CHAIN_MODELS = {
  rope: 'chain_loop.stl',
  'twisted-star': 'Twisted Star Chain.stl',
  box: 'chain_loop.stl',
  cuban: 'chain_loop.stl',
  figaro: 'chain_loop.stl',
  snake: 'chain_loop.stl'
};

export function loadChain(materialKey = 'gold', chainType = 'rope') {
  return new Promise((resolve, reject) => {
    const loader = new STLLoader();
    const modelFile = CHAIN_MODELS[chainType] || CHAIN_MODELS.rope;

    loader.load(
      modelFile,
      (geometry) => {
        geometry.computeVertexNormals();
        geometry.center();

        let attach = findChainAttachPoint(geometry);

        if (Math.abs(attach.attachX) > 0.01) {
          geometry.translate(-attach.attachX, 0, 0);
          attach = findChainAttachPoint(geometry);
        }

        const mat = MATERIALS[materialKey];
        const material = new THREE.MeshStandardMaterial({
          color: mat.color,
          metalness: mat.metalness,
          roughness: mat.roughness,
          envMapIntensity: mat.envMapIntensity
        });

        const mesh = new THREE.Mesh(geometry, material);

        const box = new THREE.Box3().setFromBufferAttribute(geometry.attributes.position);
        const size = box.getSize(new THREE.Vector3());

        resolve({
          mesh,
          geometry,
          size,
          attachPoint: attach.attachPoint,
          innerTopY: attach.innerTopY,
          innerBottomY: attach.innerBottomY,
          bailHeight: attach.bailHeight,
          chainThickness: size.z
        });
      },
      undefined,
      (error) => reject(error)
    );
  });
}

export function updateChainMaterial(mesh, materialKey) {
  const mat = MATERIALS[materialKey];
  mesh.material.color.setHex(mat.color);
  mesh.material.metalness = mat.metalness;
  mesh.material.roughness = mat.roughness;
  mesh.material.envMapIntensity = mat.envMapIntensity;
  mesh.material.needsUpdate = true;
}
