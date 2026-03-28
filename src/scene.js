import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export function createScene(container) {
  // Renderer
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: false
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;
  container.appendChild(renderer.domElement);

  // Scene
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x1a1a2e);

  // Camera
  const camera = new THREE.PerspectiveCamera(
    45,
    container.clientWidth / container.clientHeight,
    0.1,
    10000
  );
  camera.position.set(0, 0, 400);

  // Controls
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minDistance = 50;
  controls.maxDistance = 2000;
  controls.target.set(0, 0, 0);

  // Lighting
  const ambientLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.6);
  scene.add(ambientLight);

  const keyLight = new THREE.DirectionalLight(0xffffff, 1.2);
  keyLight.position.set(100, 200, 150);
  scene.add(keyLight);

  const fillLight = new THREE.DirectionalLight(0xffffff, 0.4);
  fillLight.position.set(-100, 50, -100);
  scene.add(fillLight);

  const rimLight = new THREE.DirectionalLight(0xffffff, 0.6);
  rimLight.position.set(0, -100, -200);
  scene.add(rimLight);

  // Environment map for metallic reflections
  const pmremGenerator = new THREE.PMREMGenerator(renderer);
  const envScene = new THREE.Scene();
  const envGeo = new THREE.SphereGeometry(100, 16, 16);
  const envMat = new THREE.MeshBasicMaterial({
    color: 0x888888,
    side: THREE.BackSide
  });
  envScene.add(new THREE.Mesh(envGeo, envMat));

  // Add some bright spots to env map
  const spotGeo = new THREE.SphereGeometry(10, 8, 8);
  const spotMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const spot1 = new THREE.Mesh(spotGeo, spotMat);
  spot1.position.set(50, 50, 50);
  envScene.add(spot1);
  const spot2 = new THREE.Mesh(spotGeo, spotMat);
  spot2.position.set(-30, 80, -20);
  envScene.add(spot2);

  const envMap = pmremGenerator.fromScene(envScene).texture;
  scene.environment = envMap;
  pmremGenerator.dispose();

  // Resize handler
  function onResize() {
    const w = container.clientWidth;
    const h = container.clientHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  }
  window.addEventListener('resize', onResize);

  // Animation loop
  function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
  }
  animate();

  return { scene, camera, renderer, controls };
}
