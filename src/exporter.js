import { STLExporter } from 'three/addons/exporters/STLExporter.js';
import * as THREE from 'three';

export function exportSTL(scene, filename = 'necklace.stl') {
  // Update all world matrices
  scene.updateMatrixWorld(true);

  const exporter = new STLExporter();
  const result = exporter.parse(scene, { binary: true });

  const blob = new Blob([result], { type: 'application/octet-stream' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();

  URL.revokeObjectURL(url);
}
