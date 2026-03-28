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
let pendantGroup = null;

async function init() {
  try {
    // Load chain
    const chain = await loadChain(DEFAULTS.material);
    chainMesh = chain.mesh;
    chainSize = chain.size;
    scene.add(chainMesh);

    // Generate initial pendant
    await rebuildPendant(DEFAULTS);

    // Frame the scene
    frameCamera();

    // Hide loading
    loading.classList.add('hidden');
  } catch (err) {
    console.error('Failed to load:', err);
    loading.querySelector('p').textContent = 'Failed to load chain model.';
  }
}

function frameCamera() {
  const scale = chainMesh.scale.x;
  const viewHeight = Math.max(chainSize.x, chainSize.y) * scale * 1.3;
  const fov = camera.fov * (Math.PI / 180);
  const distance = viewHeight / (2 * Math.tan(fov / 2));
  camera.position.set(0, 0, distance);
  controls.target.set(0, 0, 0);
  controls.update();
}

async function rebuildPendant(state) {
  // Remove existing pendant
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

  const result = await generatePendant({
    text: state.text,
    font: state.font,
    textSize: state.textSize,
    extrudeDepth: state.extrudeDepth,
    bevelEnabled: state.bevelEnabled,
    platePadding: state.platePadding,
    plateRadius: state.plateRadius,
    plateThickness: state.plateThickness
  }, state.material);

  if (!result) return;

  pendantGroup = result.group;

  // Position pendant at bottom center of chain
  // Chain is centered at origin; pendant hangs below
  const chainHalfHeight = (chainSize.y / 2) * chainMesh.scale.y;
  pendantGroup.position.y = -chainHalfHeight - result.bailTop + 2;
  pendantGroup.position.z = 0;

  scene.add(pendantGroup);
}

// UI
const state = initUI(async (newState, changedKey) => {
  if (changedKey === 'chainScale') {
    chainMesh.scale.setScalar(newState.chainScale);
    // Reposition pendant
    const chainHalfHeight = (chainSize.y / 2) * newState.chainScale;
    if (pendantGroup) {
      // Rebuild to reposition
      await rebuildPendant(newState);
    }
  } else if (changedKey === 'material') {
    updateChainMaterial(chainMesh, newState.material);
    updatePendantMaterial(pendantGroup, newState.material);
  } else {
    // Text, font, size, depth, bevel, plate changes — rebuild pendant
    await rebuildPendant(newState);
  }
});

// Export
exportBtn.addEventListener('click', () => {
  const text = state.text || 'necklace';
  exportSTL(scene, `${text.toLowerCase()}_necklace.stl`);
});

// Go
init();
