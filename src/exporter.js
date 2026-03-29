import { STLExporter } from 'three/addons/exporters/STLExporter.js';
import { OBJExporter } from 'three/addons/exporters/OBJExporter.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import * as THREE from 'three';

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function exportSTL(scene, filename = 'necklace.stl') {
  scene.updateMatrixWorld(true);
  const exporter = new STLExporter();
  const result = exporter.parse(scene, { binary: true });
  downloadBlob(new Blob([result], { type: 'application/octet-stream' }), filename);
}

export function exportOBJ(scene, filename = 'necklace.obj') {
  scene.updateMatrixWorld(true);
  const exporter = new OBJExporter();
  const result = exporter.parse(scene);
  downloadBlob(new Blob([result], { type: 'text/plain' }), filename);
}

export function exportGLB(scene, filename = 'necklace.glb') {
  scene.updateMatrixWorld(true);
  const exporter = new GLTFExporter();
  exporter.parse(
    scene,
    (result) => {
      downloadBlob(new Blob([result], { type: 'application/octet-stream' }), filename);
    },
    (error) => {
      console.error('GLB export failed:', error);
    },
    { binary: true }
  );
}

export function exportByFormat(scene, baseName, format) {
  const name = baseName.toLowerCase().replace(/\s+/g, '_');
  switch (format) {
    case 'obj':
      return exportOBJ(scene, `${name}_necklace.obj`);
    case 'glb':
      return exportGLB(scene, `${name}_necklace.glb`);
    case 'stl':
    default:
      return exportSTL(scene, `${name}_necklace.stl`);
  }
}

export function takeScreenshot(renderer, scene, camera) {
  renderer.render(scene, camera);
  const dataURL = renderer.domElement.toDataURL('image/png');
  const link = document.createElement('a');
  link.href = dataURL;
  link.download = 'necklace_screenshot.png';
  link.click();
}

export function computeDimensions(scene) {
  const box = new THREE.Box3().setFromObject(scene);
  if (box.isEmpty()) return null;
  const size = box.getSize(new THREE.Vector3());
  return {
    width: Math.round(size.x * 10) / 10,
    height: Math.round(size.y * 10) / 10,
    depth: Math.round(size.z * 10) / 10
  };
}
