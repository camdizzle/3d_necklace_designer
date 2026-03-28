import * as THREE from 'three';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';
import { MATERIALS } from './constants.js';

export function loadChain(materialKey = 'gold') {
  return new Promise((resolve, reject) => {
    const loader = new STLLoader();

    loader.load(
      '/ChainMakerChain.stl',
      (geometry) => {
        geometry.computeVertexNormals();
        geometry.center();

        const mat = MATERIALS[materialKey];
        const material = new THREE.MeshStandardMaterial({
          color: mat.color,
          metalness: mat.metalness,
          roughness: mat.roughness,
          envMapIntensity: mat.envMapIntensity
        });

        const mesh = new THREE.Mesh(geometry, material);

        // Analyze geometry bounds to orient properly
        const box = new THREE.Box3().setFromBufferAttribute(geometry.attributes.position);
        const size = box.getSize(new THREE.Vector3());

        // The chain is flat (thin in one axis). Orient it to face the camera.
        // If Z is the thin axis, rotate so the chain lies in the XY plane (facing camera)
        if (size.z < size.x && size.z < size.y) {
          // Already in XY plane, no rotation needed
        } else if (size.y < size.x && size.y < size.z) {
          mesh.rotation.x = Math.PI / 2;
        } else if (size.x < size.y && size.x < size.z) {
          mesh.rotation.y = Math.PI / 2;
        }

        resolve({ mesh, geometry, size });
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
