import * as THREE from 'three';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';
import { MATERIALS } from './constants.js';

function findChainTips(geometry) {
  const pos = geometry.attributes.position;
  const count = pos.count;

  // Find bounding box
  let xMin = Infinity, xMax = -Infinity, yMin = Infinity, yMax = -Infinity;
  for (let i = 0; i < count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    if (x < xMin) xMin = x;
    if (x > xMax) xMax = x;
    if (y < yMin) yMin = y;
    if (y > yMax) yMax = y;
  }

  // The STL is already in necklace orientation: arc at top (+Y), two open tips at bottom (-Y).
  // The left tip is at negative X (bottom-left), the right tip at positive X (bottom-right).
  // First pass: find the lowest Y on each side to locate the actual last link.
  let leftMinY = Infinity, rightMinY = Infinity;
  for (let i = 0; i < count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    if (x < 0 && y < leftMinY) leftMinY = y;
    if (x >= 0 && y < rightMinY) rightMinY = y;
  }

  // Collect vertices within 6 units of each side's lowest point (the last link)
  const tipRange = 6;
  const leftTipVerts = [];
  const rightTipVerts = [];

  for (let i = 0; i < count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    if (x < 0 && y < leftMinY + tipRange) {
      leftTipVerts.push(new THREE.Vector3(x, y, z));
    }
    if (x >= 0 && y < rightMinY + tipRange) {
      rightTipVerts.push(new THREE.Vector3(x, y, z));
    }
  }

  function centroid(verts) {
    const c = new THREE.Vector3();
    verts.forEach(v => c.add(v));
    c.divideScalar(verts.length);
    return c;
  }

  const tipLeft = leftTipVerts.length > 0 ? centroid(leftTipVerts) : new THREE.Vector3(xMin, yMin, 0);
  const tipRight = rightTipVerts.length > 0 ? centroid(rightTipVerts) : new THREE.Vector3(xMax, yMin, 0);

  return { tipLeft, tipRight };
}

export function loadChain(materialKey = 'gold') {
  return new Promise((resolve, reject) => {
    const loader = new STLLoader();

    loader.load(
      '/ChainMakerChain.stl',
      (geometry) => {
        geometry.computeVertexNormals();
        geometry.center();

        // Find tip positions (in centered coords)
        const tips = findChainTips(geometry);

        const mat = MATERIALS[materialKey];
        const material = new THREE.MeshStandardMaterial({
          color: mat.color,
          metalness: mat.metalness,
          roughness: mat.roughness,
          envMapIntensity: mat.envMapIntensity
        });

        const mesh = new THREE.Mesh(geometry, material);
        // No rotation needed — the STL is already in necklace orientation

        const box = new THREE.Box3().setFromBufferAttribute(geometry.attributes.position);
        const size = box.getSize(new THREE.Vector3());

        resolve({
          mesh,
          geometry,
          size,
          tipLeft: tips.tipLeft,
          tipRight: tips.tipRight,
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
