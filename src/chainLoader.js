import * as THREE from 'three';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';
import { MATERIALS } from './constants.js';

function findChainTips(geometry) {
  const pos = geometry.attributes.position;
  const count = pos.count;

  // Find bounding box to identify the axis with the opening
  let yMin = Infinity, yMax = -Infinity;
  for (let i = 0; i < count; i++) {
    const y = pos.getY(i);
    if (y < yMin) yMin = y;
    if (y > yMax) yMax = y;
  }

  // The chain opens along Y — tips are at the Y extremes
  // Collect vertices near each Y extreme (within 5 units)
  const threshold = 5;
  const tip1Verts = [];
  const tip2Verts = [];

  for (let i = 0; i < count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    if (y < yMin + threshold) tip1Verts.push(new THREE.Vector3(x, y, z));
    if (y > yMax - threshold) tip2Verts.push(new THREE.Vector3(x, y, z));
  }

  // Compute centroid of each tip cluster
  const tip1 = new THREE.Vector3();
  tip1Verts.forEach(v => tip1.add(v));
  tip1.divideScalar(tip1Verts.length);

  const tip2 = new THREE.Vector3();
  tip2Verts.forEach(v => tip2.add(v));
  tip2.divideScalar(tip2Verts.length);

  return { tip1, tip2 };
}

export function loadChain(materialKey = 'gold') {
  return new Promise((resolve, reject) => {
    const loader = new STLLoader();

    loader.load(
      '/ChainMakerChain.stl',
      (geometry) => {
        geometry.computeVertexNormals();
        geometry.center();

        // Find tip positions before rotation (in centered coords)
        const tips = findChainTips(geometry);

        const mat = MATERIALS[materialKey];
        const material = new THREE.MeshStandardMaterial({
          color: mat.color,
          metalness: mat.metalness,
          roughness: mat.roughness,
          envMapIntensity: mat.envMapIntensity
        });

        const mesh = new THREE.Mesh(geometry, material);

        // Rotate -90° around Z so the chain hangs like a necklace:
        // - Tips (Y extremes) move to X extremes (left/right at bottom)
        // - Chain body (negative X) moves to top (over the neck)
        mesh.rotation.z = -Math.PI / 2;

        // Compute rotated tip positions (x' = y, y' = -x for -90° Z rotation)
        const tip1Rotated = new THREE.Vector3(tips.tip1.y, -tips.tip1.x, tips.tip1.z);
        const tip2Rotated = new THREE.Vector3(tips.tip2.y, -tips.tip2.x, tips.tip2.z);

        // Compute size after rotation
        const box = new THREE.Box3().setFromBufferAttribute(geometry.attributes.position);
        const rawSize = box.getSize(new THREE.Vector3());
        // After 90° rotation, X and Y swap
        const size = new THREE.Vector3(rawSize.y, rawSize.x, rawSize.z);

        resolve({
          mesh,
          geometry,
          size,
          tipLeft: tip1Rotated,   // left tip (negative X)
          tipRight: tip2Rotated,  // right tip (positive X)
          chainThickness: rawSize.z
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
