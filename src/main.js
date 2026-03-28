import { createScene } from './scene.js';
import { loadChain, updateChainMaterial } from './chainLoader.js';
import { generatePendant, updatePendantMaterial } from './pendantGenerator.js';
import { exportSTL } from './exporter.js';
import { initUI } from './ui.js';
import { DEFAULTS } from './constants.js';

const viewport = document.getElementById('viewport');
const loading = document.getElementById('loading');
const exportBtn = document.getElementById('export-btn');

const { scene, camera, controls } = createScene(viewport);

let chainMesh = null;
let chainSize = null;
let chainInfo = null;
let pendantGroup = null;

async function init() {
  try {
    const chain = await loadChain(DEFAULTS.material);
    chainMesh = chain.mesh;
    chainSize = chain.size;
    chainInfo = {
      tipLeft: chain.tipLeft,
      tipRight: chain.tipRight,
      chainThickness: chain.chainThickness
    };
    scene.add(chainMesh);

    await rebuildPendant(DEFAULTS);
    frameCamera();
    loading.classList.add('hidden');
  } catch (err) {
    console.error('Failed to load:', err);
    loading.querySelector('p').textContent = 'Failed to load chain model.';
  }
}

function frameCamera() {
  const scale = chainMesh.scale.x;
  const viewHeight = Math.max(chainSize.x, chainSize.y) * scale * 1.5;
  const fov = camera.fov * (Math.PI / 180);
  const distance = viewHeight / (2 * Math.tan(fov / 2));
  camera.position.set(0, 0, distance);
  controls.target.set(0, -20, 0);
  controls.update();
}

async function rebuildPendant(state) {
  if (pendantGroup) {
    scene.remove(pendantGroup);
    pendantGroup.traverse((child) => {
      if (child.isMesh) {
        child.geometry.dispose();
        child.material.dispose();
      }
    });
    pendantGroup = null;
  }

  // Scale chain info tips by current chain scale
  const scale = state.chainScale;
  const scaledChainInfo = chainInfo ? {
    tipLeft: chainInfo.tipLeft.clone().multiplyScalar(scale),
    tipRight: chainInfo.tipRight.clone().multiplyScalar(scale),
    chainThickness: chainInfo.chainThickness * scale
  } : null;

  const result = await generatePendant({
    text: state.text,
    font: state.font,
    textSize: state.textSize,
    extrudeDepth: state.extrudeDepth,
    bevelEnabled: state.bevelEnabled,
    platePadding: state.platePadding,
    plateRadius: state.plateRadius,
    plateThickness: state.plateThickness
  }, state.material, scaledChainInfo);

  if (!result) return;

  pendantGroup = result.group;

  // Position pendant: centered horizontally, below the chain tips
  if (result.tipLeft && result.tipRight) {
    const midX = (result.tipLeft.x + result.tipRight.x) / 2;
    pendantGroup.position.x = midX;
    pendantGroup.position.y = result.pendantCenterY;
    pendantGroup.position.z = 0;
  }

  scene.add(pendantGroup);
}

// UI
const state = initUI(async (newState, changedKey) => {
  if (changedKey === 'chainScale') {
    chainMesh.scale.setScalar(newState.chainScale);
    await rebuildPendant(newState);
  } else if (changedKey === 'material') {
    updateChainMaterial(chainMesh, newState.material);
    updatePendantMaterial(pendantGroup, newState.material);
  } else {
    await rebuildPendant(newState);
  }
});

// Export
exportBtn.addEventListener('click', () => {
  const text = state.text || 'necklace';
  exportSTL(scene, `${text.toLowerCase()}_necklace.stl`);
});

init();
