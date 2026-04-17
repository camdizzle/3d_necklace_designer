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

  return {
    attachPoint: new THREE.Vector3(attachX, gapEnd, 0),
    innerTopY: gapEnd,
    innerBottomY: gapStart,
    attachX
  };
}

export function loadChain(materialKey = 'gold') {
  return new Promise((resolve, reject) => {
    const loader = new STLLoader();

    loader.load(
      'chain_loop.stl',
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
