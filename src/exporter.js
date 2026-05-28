import * as THREE from 'three';

export function takeScreenshot(renderer, scene, camera, options = {}) {
  const { watermark = false } = options;
  renderer.render(scene, camera);
  const source = renderer.domElement;

  if (!watermark) {
    const dataURL = source.toDataURL('image/png');
    triggerDownload(dataURL, 'necklace_screenshot.png');
    return;
  }

  // Composite the source canvas onto a new canvas so we can draw the
  // watermark on top without mutating the live renderer canvas.
  const canvas = document.createElement('canvas');
  canvas.width = source.width;
  canvas.height = source.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    triggerDownload(source.toDataURL('image/png'), 'necklace_screenshot.png');
    return;
  }
  ctx.drawImage(source, 0, 0);

  // Semi-transparent bar along the bottom, then branded text.
  const barH = Math.round(canvas.height * 0.07);
  ctx.fillStyle = 'rgba(22, 33, 62, 0.78)';
  ctx.fillRect(0, canvas.height - barH, canvas.width, barH);

  const fontSize = Math.round(barH * 0.42);
  ctx.font = `700 ${fontSize}px 'Segoe UI', system-ui, -apple-system, sans-serif`;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';
  ctx.fillStyle = '#FFD700';
  ctx.fillText(
    'CHAIN STUDIO  •  made with the free 3D necklace designer',
    canvas.width / 2,
    canvas.height - barH / 2
  );

  triggerDownload(canvas.toDataURL('image/png'), 'necklace_screenshot.png');
}

function triggerDownload(dataURL, filename) {
  const link = document.createElement('a');
  link.href = dataURL;
  link.download = filename;
  link.click();
}

export function computeDimensions(group) {
  if (!group) return null;
  const box = new THREE.Box3().setFromObject(group);
  if (box.isEmpty()) return null;
  const size = box.getSize(new THREE.Vector3());
  return {
    width: Math.round(size.x * 10) / 10,
    height: Math.round(size.y * 10) / 10,
    depth: Math.round(size.z * 10) / 10
  };
}
