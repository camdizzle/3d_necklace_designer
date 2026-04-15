import * as THREE from 'three';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';
import { MATERIALS } from './constants.js';
import { createMaterial } from './pendantGenerator.js';

function findChainAttachPoint(geometry) {
  const pos = geometry.attributes.position;
  const count = pos.count;

  // The chain is a closed loop. Find the interior space by scanning vertices
  // near X=0 and finding the largest gap in Y — that's the open interior.
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

  // Find the largest gap — that's the interior of the chain loop
  let maxGap = 0, gapStart = 0, gapEnd = 0;
  for (let i = 1; i < yVals.length; i++) {
    const gap = yVals[i] - yVals[i - 1];
    if (gap > maxGap) {
      maxGap = gap;
      gapStart = yVals[i - 1];  // inner bottom (top of bottom chain band)
      gapEnd = yVals[i];        // inner top (bottom of top chain band)
    }
  }

  // Find the actual X center of the attachment region. geometry.center() only
  // centers the bounding box — if the chain STL has any asymmetry (clasp,
  // uneven link pattern), the pendant would hang from X=0 while the chain's
  // inner loop top sits slightly off-center, making the pendant look offset.
  // We sample vertices near innerTopY and take their mean X as the true
  // attachment center so the caller can translate the chain to match.
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
      '/chain_loop.stl',
      (geometry) => {
        geometry.computeVertexNormals();
        geometry.center();

        const initialAttach = findChainAttachPoint(geometry);
        let attach = initialAttach;

        // Split the difference: if the detected attach point is off-center,
        // shift the chain geometry halfway so the visual center doesn't swing
        // too far. The remaining attachX is returned so the caller can place
        // the pendant (and its connector) at that X, keeping the connector
        // aligned with the chain's inner-loop top regardless of STL asymmetry.
        if (Math.abs(initialAttach.attachX) > 0.01) {
          geometry.translate(-initialAttach.attachX / 2, 0, 0);
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
          attachX: attach.attachX,
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
