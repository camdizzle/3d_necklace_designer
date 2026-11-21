// Pictures of the design for the order list, "My designs" and share
// previews. Renders a close-up of the pendant at a fixed size without
// moving the visible camera for longer than one frame.

import * as THREE from 'three';

export function capturePendant({ renderer, scene, camera, controls, target }, {
  width = 320, height = 240, quality = 0.8, pad = 2.1
} = {}) {
  if (!target) return '';
  const box = new THREE.Box3().setFromObject(target);
  if (box.isEmpty()) return '';

  const saved = {
    pos: camera.position.clone(),
    quat: camera.quaternion.clone(),
    aspect: camera.aspect,
    target: controls.target.clone(),
    size: renderer.getSize(new THREE.Vector2()),
    ratio: renderer.getPixelRatio()
  };

  try {
    renderer.setPixelRatio(1);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();

    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    // Aim a little above the pendant so the bail and chain show.
    center.y += size.y * 0.18;
    const fov = camera.fov * Math.PI / 180;
    const dist = Math.max(
      (size.y * pad) / (2 * Math.tan(fov / 2)),
      (size.x * pad) / (2 * Math.tan(fov / 2) * camera.aspect)
    );
    const yaw = 0.35, pitch = 0.12;
    camera.position.set(
      center.x + dist * Math.sin(yaw) * Math.cos(pitch),
      center.y + dist * Math.sin(pitch),
      center.z + dist * Math.cos(yaw) * Math.cos(pitch)
    );
    camera.lookAt(center);
    renderer.render(scene, camera);
    return renderer.domElement.toDataURL('image/jpeg', quality);
  } catch {
    return '';
  } finally {
    renderer.setPixelRatio(saved.ratio);
    renderer.setSize(saved.size.x, saved.size.y, false);
    camera.aspect = saved.aspect;
    camera.updateProjectionMatrix();
    camera.position.copy(saved.pos);
    camera.quaternion.copy(saved.quat);
    controls.target.copy(saved.target);
    controls.update();
    renderer.render(scene, camera);
  }
}
