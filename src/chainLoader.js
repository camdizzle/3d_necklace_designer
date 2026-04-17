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
  // Measure the full X extent of vertices inside the gap — this tells us
  // how wide the connector opening actually is.
  let xSum = 0, xCount = 0, gapXMin = Infinity, gapXMax = -Infinity;
  for (let i = 0; i < count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    if (y > gapStart && y < gapEnd) {
      gapXMin = Math.min(gapXMin, x);
      gapXMax = Math.max(gapXMax, x);
    }
    const yTolerance = Math.max(2, maxGap * 0.05);
    if (Math.abs(y - gapEnd) < yTolerance) {
      xSum += x;
      xCount++;
    }
  }
  const attachX = xCount > 0 ? xSum / xCount : 0;
  const gapXWidth = (gapXMax - gapXMin) || 30;

  return {
    attachPoint: new THREE.Vector3(attachX, gapEnd, 0),
    innerTopY: gapEnd,
    innerBottomY: gapStart,
    attachX,
    gapXWidth
  };
}

function removeBuiltInConnector(geometry, innerBottomY, innerTopY, gapXWidth) {
  const pos = geometry.attributes.position;
  const normal = geometry.attributes.normal;
  const triCount = pos.count / 3;

  // Only remove triangles inside the gap Y range AND within the measured
  // gap X width. Side chain links sit at the same Y range but are far
  // from center X, so the X limit protects them.
  const xLimit = gapXWidth * 0.6;

  const keepIndices = [];

  for (let t = 0; t < triCount; t++) {
    const i = t * 3;
    const ay = pos.getY(i), by = pos.getY(i + 1), cy = pos.getY(i + 2);
    const ax = pos.getX(i), bx = pos.getX(i + 1), cx = pos.getX(i + 2);

    const allInGap = ay > innerBottomY && ay < innerTopY &&
                     by > innerBottomY && by < innerTopY &&
                     cy > innerBottomY && cy < innerTopY;
    const allNearCenter = Math.abs(ax) < xLimit &&
                          Math.abs(bx) < xLimit &&
                          Math.abs(cx) < xLimit;

    if (!(allInGap && allNearCenter)) {
      keepIndices.push(i, i + 1, i + 2);
    }
  }

  const newPos = new Float32Array(keepIndices.length * 3);
  const newNorm = new Float32Array(keepIndices.length * 3);

  for (let i = 0; i < keepIndices.length; i++) {
    const src = keepIndices[i];
    newPos[i * 3] = pos.getX(src);
    newPos[i * 3 + 1] = pos.getY(src);
    newPos[i * 3 + 2] = pos.getZ(src);
    newNorm[i * 3] = normal.getX(src);
    newNorm[i * 3 + 1] = normal.getY(src);
    newNorm[i * 3 + 2] = normal.getZ(src);
  }

  const newGeo = new THREE.BufferGeometry();
  newGeo.setAttribute('position', new THREE.BufferAttribute(newPos, 3));
  newGeo.setAttribute('normal', new THREE.BufferAttribute(newNorm, 3));
  return newGeo;
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

        // If the detected attach point is off-center in X, translate the
        // geometry so the attachment area lands on X=0. The pendant hangs
        // from X=0, so this keeps it visually aligned with the chain opening.
        if (Math.abs(attach.attachX) > 0.01) {
          geometry.translate(-attach.attachX, 0, 0);
          attach = findChainAttachPoint(geometry);
        }

        const cleaned = removeBuiltInConnector(geometry, attach.innerBottomY, attach.innerTopY, attach.gapXWidth);

        const mat = MATERIALS[materialKey];
        const material = new THREE.MeshStandardMaterial({
          color: mat.color,
          metalness: mat.metalness,
          roughness: mat.roughness,
          envMapIntensity: mat.envMapIntensity
        });

        const mesh = new THREE.Mesh(cleaned, material);

        const box = new THREE.Box3().setFromBufferAttribute(cleaned.attributes.position);
        const size = box.getSize(new THREE.Vector3());

        resolve({
          mesh,
          geometry: cleaned,
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
