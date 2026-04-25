import * as THREE from 'three';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';
import { createScene } from './scene.js';
import { loadChain, updateChainMaterial } from './chainLoader.js';
import { generatePendant, updateMaterialOnGroup, createMaterial } from './pendantGenerator.js';
import { STLExporter } from 'three/addons/exporters/STLExporter.js';
import { exportByFormat, takeScreenshot, computeDimensions } from './exporter.js';
import { initUI } from './ui.js';
import { DEFAULTS } from './constants.js';
import { traceImageSilhouette, createHeightmapData } from './imageProcessor.js';
import { initPremium, isPro, showUpgradeModal, FEATURES } from './premium.js';
import { createUndoRedo } from './undoRedo.js';
import { csAlert, csConfirm, csPrompt } from './modal.js';
import { stateToShareUrl, loadStateFromUrl, clearShareHash } from './shareUrl.js';

const viewport = document.getElementById('viewport');
const loading = document.getElementById('loading');
const exportBtn = document.getElementById('export-btn');
const screenshotBtn = document.getElementById('screenshot-btn');
const resetBtn = document.getElementById('reset-btn');
const savePresetBtn = document.getElementById('save-preset-btn');
const loadPresetBtn = document.getElementById('load-preset-btn');
const dimensionsEl = document.getElementById('dimensions-display');
const orderBtn = document.getElementById('order-btn');
const orderModal = document.getElementById('order-modal');
const orderModalDetails = document.getElementById('order-modal-details');
const orderModalGo = document.getElementById('order-modal-go');
const orderModalCancel = document.getElementById('order-modal-cancel');
const orderModalPrice = document.getElementById('order-modal-price');
const orderQuantityInput = document.getElementById('order-quantity');
const orderDiscountNote = document.getElementById('order-discount-note');
const qtyMinus = document.getElementById('qty-minus');
const qtyPlus = document.getElementById('qty-plus');
const orderCommentsInput = document.getElementById('order-comments');

const undoRedo = createUndoRedo();
const shareBtn = document.getElementById('share-btn');
const undoBtn = document.getElementById('undo-btn');
const redoBtn = document.getElementById('redo-btn');
const orderPreviewWrap = document.getElementById('order-preview-wrap');

const { scene, camera, renderer, controls } = createScene(viewport);

let chainMesh = null;
let chainSize = null;
let chainInfo = null;
let pendantGroup = null;
let lastPendantCenterY = 0;
let lastDefaultZ = 0;
let lastPendantWidth = 0;
let lastPendantHeight = 0;
let silhouetteImageFile = null;
let reliefImageFile = null;
const fixedDiameterInput = document.getElementById('fixed-diameter');
const clearFixedDiameterBtn = document.getElementById('clear-fixed-diameter');

function getMaterialOpts(state) {
  return {
    key: state.material,
    customColor: state.customColor,
    useCustomColor: state.useCustomColor,
    matteFinish: state.matteFinish
  };
}

function getChainMaterialOpts(state) {
  if (state.twoTone) {
    return {
      key: state.chainMaterial,
      customColor: null,
      useCustomColor: false,
      matteFinish: state.matteFinish
    };
  }
  return getMaterialOpts(state);
}

async function init() {
  try {
    const chain = await loadChain(state.material || DEFAULTS.material, state.chainType || DEFAULTS.chainType);
    chainMesh = chain.mesh;
    chainSize = chain.size;
    chainInfo = {
      innerTopY: chain.innerTopY,
      innerBottomY: chain.innerBottomY,
      bailHeight: chain.bailHeight,
      bailZCenter: chain.bailZCenter,
      chainThickness: chain.chainThickness
    };
    scene.add(chainMesh);

    await rebuildPendant(state);
    frameCamera();
    loading.classList.add('hidden');
    updateDimensions();
  } catch (err) {
    console.error('Failed to load:', err);
    loading.querySelector('p').textContent = 'Failed to load chain model.';
  }
}

function frameCamera() {
  const scale = chainMesh.scale.x;
  const viewSize = Math.max(chainSize.x, chainSize.y) * scale * 1.3;
  const fov = camera.fov * (Math.PI / 180);
  const distance = viewSize / (2 * Math.tan(fov / 2));
  camera.position.set(0, 0, distance);
  controls.target.set(0, 0, 0);
  controls.update();
}

function updateDimensions() {
  if (!dimensionsEl) return;
  if (!state.showDimensions) {
    dimensionsEl.style.display = 'none';
    return;
  }
  const dims = computeDimensions(pendantGroup);
  if (dims) {
    dimensionsEl.style.display = 'block';
    dimensionsEl.textContent = `${dims.width} x ${dims.height} x ${dims.depth} mm`;
  }
}

function applyFixedDiameter(state) {
  const diameter = parseFloat(fixedDiameterInput?.value);
  if (!diameter || diameter <= 0 || lastPendantWidth <= 0) return;
  const maxDim = Math.max(lastPendantWidth, lastPendantHeight);
  if (maxDim <= 0) return;
  const needed = diameter / maxDim;
  state.pendantScale = Math.round(needed * 100) / 100;
  const scaleSlider = document.getElementById('pendant-scale');
  const scaleVal = document.getElementById('pendant-scale-val');
  if (scaleSlider) scaleSlider.value = state.pendantScale;
  if (scaleVal) scaleVal.textContent = state.pendantScale.toFixed(2);
}

function applyPendantTransform(state) {
  if (!pendantGroup) return;
  const ps = state.pendantScale;
  pendantGroup.scale.setScalar(ps);
  pendantGroup.position.set(
    state.pendantOffsetX,
    lastPendantCenterY + state.pendantOffsetY,
    lastDefaultZ * ps + state.pendantOffsetZ
  );
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

  const scale = state.chainScale;
  const scaledChainInfo = chainInfo ? {
    innerTopY: chainInfo.innerTopY * scale,
    innerBottomY: chainInfo.innerBottomY * scale,
    bailHeight: chainInfo.bailHeight * scale,
    bailZCenter: chainInfo.bailZCenter * scale,
    chainThickness: chainInfo.chainThickness * scale
  } : null;

  const result = await generatePendant({
    text: state.text,
    font: state.font,
    textSize: state.textSize,
    textCurve: state.textCurve,
    textOffsetX: state.textOffsetX,
    textOffsetY: state.textOffsetY,
    letterSpacing: state.letterSpacing,
    extrudeDepth: state.extrudeDepth,
    bevelEnabled: state.bevelEnabled,
    alignToPlate: state.alignToPlate,
    platePadding: state.platePadding,
    plateRadius: state.plateRadius,
    plateThickness: state.plateThickness,
    pendantShape: state.pendantShape,
    lineSpacing: state.lineSpacing,
    textAlignment: state.textAlignment,
    secondLineText: state.secondLineText,
    secondLineFont: state.secondLineFont,
    secondLineSize: state.secondLineSize,
    secondLineCurve: state.secondLineCurve,
    secondLineOffsetX: state.secondLineOffsetX,
    secondLineOffsetY: state.secondLineOffsetY,
    secondLineLetterSpacing: state.secondLineLetterSpacing,
    secondLineExtrudeDepth: state.secondLineExtrudeDepth,
    secondLineBevelEnabled: state.secondLineBevelEnabled,
    secondLineAlignToPlate: state.secondLineAlignToPlate,
    thirdLineText: state.thirdLineText,
    thirdLineFont: state.thirdLineFont,
    thirdLineSize: state.thirdLineSize,
    thirdLineCurve: state.thirdLineCurve,
    thirdLineOffsetX: state.thirdLineOffsetX,
    thirdLineOffsetY: state.thirdLineOffsetY,
    thirdLineLetterSpacing: state.thirdLineLetterSpacing,
    thirdLineExtrudeDepth: state.thirdLineExtrudeDepth,
    thirdLineBevelEnabled: state.thirdLineBevelEnabled,
    thirdLineAlignToPlate: state.thirdLineAlignToPlate,
    engrave: state.engrave,
    borderWidth: state.borderWidth,
    customShapePoints: state.customShapePoints,
    reliefData: state.reliefData,
    reliefHeight: state.reliefHeight,
    customSTLGeometry: state.customSTLGeometry,
    lineColor1: state.lineColor1,
    lineColor2: state.lineColor2,
    lineColor3: state.lineColor3,
    lockedPlateW: state.lockPendantSize ? state.lockedPlateW : null,
    lockedPlateH: state.lockPendantSize ? state.lockedPlateH : null,
    chainType: state.chainType
  }, getMaterialOpts(state), scaledChainInfo);

  if (!result) return;

  // Capture plate dimensions for lock feature
  if (result.rawW != null && result.rawH != null) {
    state.lockedPlateW = result.rawW;
    state.lockedPlateH = result.rawH;
  }

  pendantGroup = result.group;
  lastPendantCenterY = result.pendantCenterY || 0;
  lastDefaultZ = result.defaultZ || 0;
  lastPendantWidth = result.width || 0;
  lastPendantHeight = result.height || 0;

  applyFixedDiameter(state);
  applyPendantTransform(state);

  scene.add(pendantGroup);
  updateDimensions();
}

function applyChainMaterial(state) {
  if (!chainMesh) return;
  const opts = getChainMaterialOpts(state);
  const mat = createMaterial(opts.key, opts);
  chainMesh.material.color.copy(mat.color);
  chainMesh.material.metalness = mat.metalness;
  chainMesh.material.roughness = mat.roughness;
  chainMesh.material.envMapIntensity = mat.envMapIntensity;
  chainMesh.material.needsUpdate = true;
}

// UI
const state = initUI(async (newState, changedKey) => {
  window.dispatchEvent(new CustomEvent('state-changed', { detail: changedKey }));
  // Background color
  if (changedKey === 'backgroundColor') {
    scene.background = new THREE.Color(newState.backgroundColor);
    return;
  }

  // Hide chain toggle
  if (changedKey === 'hideChain') {
    if (chainMesh) chainMesh.visible = !newState.hideChain;
    return;
  }

  // Show dimensions toggle
  if (changedKey === 'showDimensions') {
    updateDimensions();
    return;
  }

  // Auto-rotate toggle
  if (changedKey === 'autoRotate') {
    controls.autoRotate = newState.autoRotate;
    return;
  }

  // Quick repositioning — no rebuild needed, just update transform in-place
  if (['pendantOffsetX', 'pendantOffsetY', 'pendantOffsetZ', 'pendantScale'].includes(changedKey)) {
    applyPendantTransform(newState);
    updateDimensions();
    return;
  }

  // Chain type change — reload the chain model
  if (changedKey === 'chainType') {
    try {
      const matKey = newState.twoTone ? newState.chainMaterial : newState.material;
      const chain = await loadChain(matKey, newState.chainType);
      scene.remove(chainMesh);
      chainMesh.geometry.dispose();
      chainMesh.material.dispose();
      chainMesh = chain.mesh;
      chainSize = chain.size;
      chainInfo = {
        innerTopY: chain.innerTopY,
        innerBottomY: chain.innerBottomY,
        bailHeight: chain.bailHeight,
        bailZCenter: chain.bailZCenter,
        chainThickness: chain.chainThickness
      };
      chainMesh.scale.setScalar(newState.chainScale);
      chainMesh.visible = !newState.hideChain;
      scene.add(chainMesh);
      await rebuildPendant(newState);
    } catch (err) {
      console.error('Failed to load chain:', err);
    }
    return;
  }

  // Chain scale
  if (changedKey === 'chainScale') {
    chainMesh.scale.setScalar(newState.chainScale);
    await rebuildPendant(newState);
    return;
  }

  // Material changes (pendant only or both)
  if (['material', 'customColor', 'useCustomColor', 'matteFinish'].includes(changedKey)) {
    updateMaterialOnGroup(pendantGroup, getMaterialOpts(newState));
    if (!newState.twoTone) {
      applyChainMaterial(newState);
    }
    updateDimensions();
    return;
  }

  // Chain-specific material (two-tone)
  if (['chainMaterial', 'twoTone'].includes(changedKey)) {
    applyChainMaterial(newState);
    if (changedKey === 'twoTone' && !newState.twoTone) {
      // Sync chain to pendant material
      applyChainMaterial(newState);
    }
    return;
  }

  // Re-trace silhouette when threshold changes
  if (changedKey === 'imageThreshold' && silhouetteImageFile) {
    try {
      const points = await traceImageSilhouette(silhouetteImageFile, { threshold: newState.imageThreshold });
      if (points.length >= 3) {
        newState.customShapePoints = points;
        newState.pendantShape = 'custom';
      }
    } catch (err) {
      console.error('Re-trace failed:', err);
    }
    await rebuildPendant(newState);
    return;
  }

  // Re-generate heightmap when resolution or invert changes
  if (['reliefResolution', 'reliefInvert'].includes(changedKey) && reliefImageFile) {
    try {
      const heightmap = await createHeightmapData(reliefImageFile, {
        resolution: newState.reliefResolution,
        invert: newState.reliefInvert
      });
      newState.reliefData = heightmap;
    } catch (err) {
      console.error('Heightmap regeneration failed:', err);
    }
    await rebuildPendant(newState);
    return;
  }

  // Everything else triggers a full rebuild
  await rebuildPendant(newState);
});

// Export (Pro-gated)
if (exportBtn) exportBtn.addEventListener('click', async () => {
  if (!isPro()) {
    showUpgradeModal(FEATURES.export);
    return;
  }
  if (!pendantGroup) {
    await csAlert('No pendant to export.');
    return;
  }
  const text = state.text || 'necklace';
  exportByFormat(pendantGroup, text, state.exportFormat || 'stl');
});

// Screenshot — free with watermark, Pro without.
if (screenshotBtn) {
  screenshotBtn.addEventListener('click', () => {
    takeScreenshot(renderer, scene, camera, { watermark: !isPro() });
  });
}

// Fixed diameter input
if (fixedDiameterInput) {
  fixedDiameterInput.addEventListener('change', async () => {
    if (pendantGroup) {
      applyFixedDiameter(state);
      applyPendantTransform(state);
      updateDimensions();
    }
  });
}
if (clearFixedDiameterBtn) {
  clearFixedDiameterBtn.addEventListener('click', () => {
    if (fixedDiameterInput) fixedDiameterInput.value = '';
  });
}

// Order pricing: $25 each, buy 3 get 1 free (25% off every 4)
const UNIT_PRICE = 2500; // cents

function computeOrderPricing(qty) {
  const freeItems = Math.floor(qty / 4);
  const paidItems = qty - freeItems;
  const totalCents = paidItems * UNIT_PRICE;
  const fullPrice = qty * UNIT_PRICE;
  const savings = fullPrice - totalCents;
  return { totalCents, paidItems, freeItems, savings };
}

function updateOrderPriceDisplay() {
  if (!orderQuantityInput || !orderModalPrice) return;
  const qty = Math.max(1, parseInt(orderQuantityInput.value) || 1);
  const { totalCents, freeItems, savings } = computeOrderPricing(qty);
  const total = (totalCents / 100).toFixed(2);
  orderModalPrice.innerHTML = `$${total} <span>+ free shipping</span>`;
  if (freeItems > 0) {
    orderDiscountNote.textContent = `Buy 3 get 1 free! ${freeItems} free chain${freeItems > 1 ? 's' : ''} — you save $${(savings / 100).toFixed(2)}`;
  } else if (qty >= 2) {
    orderDiscountNote.textContent = `Add ${4 - qty} more for a free chain!`;
  } else {
    orderDiscountNote.textContent = '';
  }
}

if (qtyMinus) {
  qtyMinus.addEventListener('click', () => {
    const cur = parseInt(orderQuantityInput.value) || 1;
    if (cur > 1) { orderQuantityInput.value = cur - 1; updateOrderPriceDisplay(); }
  });
}
if (qtyPlus) {
  qtyPlus.addEventListener('click', () => {
    const cur = parseInt(orderQuantityInput.value) || 1;
    if (cur < 99) { orderQuantityInput.value = cur + 1; updateOrderPriceDisplay(); }
  });
}
if (orderQuantityInput) {
  orderQuantityInput.addEventListener('input', updateOrderPriceDisplay);
}

// Order This Chain — opens modal, then sends to Stripe Checkout
function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function buildDesignDetails(st) {
  const lineEntries = [
    { text: st.text, font: st.font, color: st.lineColor1 },
    { text: st.secondLineText, font: st.secondLineFont, color: st.lineColor2 },
    { text: st.thirdLineText, font: st.thirdLineFont, color: st.lineColor3 }
  ];
  const parts = [];
  lineEntries.forEach((l, i) => {
    if (!l.text) return;
    let line = `Line ${i + 1}: "${l.text}" (${l.font})`;
    if (l.color) line += ` [color: ${l.color}]`;
    parts.push(line);
  });
  parts.push(`Shape: ${st.pendantShape}`);
  parts.push(`Material: ${st.material}`);
  if (st.twoTone) parts.push(`Chain material: ${st.chainMaterial}`);
  if (st.matteFinish) parts.push('Finish: matte');
  if (st.engrave) parts.push('Engraved text');
  return parts.join('\n');
}

if (orderBtn) {
  orderBtn.addEventListener('click', () => {
    const lines = [state.text, state.secondLineText, state.thirdLineText].filter(Boolean);
    const designName = lines.join(' / ') || 'Custom Chain';
    const details = buildDesignDetails(state);

    if (orderQuantityInput) orderQuantityInput.value = 1;
    if (orderCommentsInput) orderCommentsInput.value = '';
    updateOrderPriceDisplay();

    let detailsHtml =
      `<strong>Design:</strong> ${esc(designName)}<br>` +
      `<strong>Shape:</strong> ${esc(state.pendantShape)}<br>` +
      `<strong>Material look:</strong> ${esc(state.material)}` +
      (state.twoTone ? ` / chain: ${esc(state.chainMaterial)}` : '') + `<br>`;

    const colorLabels = [
      { text: state.text, color: state.lineColor1 },
      { text: state.secondLineText, color: state.lineColor2 },
      { text: state.thirdLineText, color: state.lineColor3 }
    ].filter(e => e.text && e.color);

    if (colorLabels.length > 0) {
      detailsHtml += `<strong>Text colors:</strong> `;
      detailsHtml += colorLabels.map(e =>
        `"${esc(e.text)}" <span style="display:inline-block;width:12px;height:12px;background:${esc(e.color)};border-radius:2px;vertical-align:middle;border:1px solid rgba(255,255,255,0.2)"></span> ${esc(e.color)}`
      ).join(', ') + `<br>`;
    }

    detailsHtml += `<strong>Note:</strong> All chains are 3D printed in high-quality plastic with a ${esc(state.material)}-tone finish.`;

    orderModalDetails.innerHTML = detailsHtml;
    orderModal.classList.add('open');

    const goHandler = async () => {
      orderModalGo.disabled = true;
      orderModalGo.textContent = 'PREPARING...';

      const qty = Math.max(1, parseInt(orderQuantityInput?.value) || 1);
      const { totalCents } = computeOrderPricing(qty);
      const comments = orderCommentsInput?.value?.trim() || '';

      try {
        if (!pendantGroup) {
          csAlert('No pendant to export.');
          orderModalGo.disabled = false;
          orderModalGo.textContent = 'PROCEED TO CHECKOUT';
          return;
        }
        pendantGroup.updateMatrixWorld(true);
        const exporter = new STLExporter();
        const stlBuffer = exporter.parse(pendantGroup, { binary: true });

        const bytes = new Uint8Array(stlBuffer);
        let binary = '';
        for (let i = 0; i < bytes.byteLength; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        const stlBase64 = btoa(binary);

        const res = await fetch('/api/checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            stlBase64,
            designName,
            designDetails: details,
            quantity: qty,
            comments
          })
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: 'Server error' }));
          throw new Error(err.error || 'Checkout failed');
        }

        const { url } = await res.json();
        window.location.href = url;
      } catch (err) {
        console.error('Order failed:', err);
        csAlert('Failed to start checkout: ' + err.message);
        orderModalGo.disabled = false;
        orderModalGo.textContent = 'PROCEED TO CHECKOUT';
      }

      orderModalGo.removeEventListener('click', goHandler);
    };

    orderModalGo.disabled = false;
    orderModalGo.textContent = 'PROCEED TO CHECKOUT';
    orderModalGo.addEventListener('click', goHandler, { once: true });
  });
}

if (orderModalCancel) {
  orderModalCancel.addEventListener('click', () => {
    orderModal.classList.remove('open');
  });
}

// Close order modal on backdrop click
if (orderModal) {
  orderModal.addEventListener('click', (e) => {
    if (e.target === orderModal) orderModal.classList.remove('open');
  });
}

// Handle order success/cancel URL params (redirect back from Stripe)
{
  const params = new URLSearchParams(window.location.search);
  const orderStatus = params.get('order');
  if (orderStatus === 'success' || orderStatus === 'cancelled') {
    // Clean the URL
    const url = new URL(window.location.href);
    url.searchParams.delete('order');
    window.history.replaceState({}, '', url.toString());

    // Show toast
    const toast = document.createElement('div');
    toast.className = `order-toast ${orderStatus}`;
    toast.textContent = orderStatus === 'success'
      ? 'Order placed! Check your email for confirmation.'
      : 'Order cancelled. Your design is still here whenever you\'re ready.';
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 6000);
  }
}

// Reset with confirmation
if (resetBtn) {
  resetBtn.addEventListener('click', async () => {
    const confirmed = await csConfirm('Reset all settings to defaults? This cannot be undone.');
    if (!confirmed) return;
    window.dispatchEvent(new CustomEvent('reset-to-defaults'));
  });
}

// Save preset
if (savePresetBtn) {
  savePresetBtn.addEventListener('click', async () => {
    const name = await csPrompt('Preset name:');
    if (!name) return;
    const presets = JSON.parse(localStorage.getItem('necklace_presets') || '{}');
    const saveState = { ...state };
    delete saveState.reliefData;
    delete saveState.customSTLGeometry;
    presets[name] = saveState;
    localStorage.setItem('necklace_presets', JSON.stringify(presets));
    window.dispatchEvent(new CustomEvent('presets-updated'));
  });
}

// Load preset
if (loadPresetBtn) {
  loadPresetBtn.addEventListener('click', async () => {
    const presets = JSON.parse(localStorage.getItem('necklace_presets') || '{}');
    const names = Object.keys(presets);
    if (names.length === 0) {
      await csAlert('No saved presets.');
      return;
    }
    const name = await csPrompt('Load preset:<br><span style="font-size:12px;color:var(--text-dim)">' + names.join(', ') + '</span>');
    if (!name || !presets[name]) return;
    window.dispatchEvent(new CustomEvent('load-preset', { detail: presets[name] }));
  });
}

const MAX_UPLOAD_MB = 10;
function checkFileSize(file) {
  if (file.size > MAX_UPLOAD_MB * 1024 * 1024) {
    csAlert(`File is too large (max ${MAX_UPLOAD_MB}MB).`);
    return false;
  }
  return true;
}

// SVG import (Pro)
const svgInput = document.getElementById('svg-import');
if (svgInput) {
  svgInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!checkFileSize(file)) { svgInput.value = ''; return; }
    if (!isPro()) {
      svgInput.value = '';
      showUpgradeModal(FEATURES.customSvg);
      return;
    }

    const text = await file.text();
    try {
      const { SVGLoader } = await import('three/addons/loaders/SVGLoader.js');
      const loader = new SVGLoader();
      const data = loader.parse(text);

      // Extract all shapes from SVG paths
      const allPoints = [];
      for (const path of data.paths) {
        const shapes = SVGLoader.createShapes(path);
        for (const shape of shapes) {
          const pts = shape.getPoints(48);
          for (const p of pts) {
            allPoints.push([p.x, p.y]);
          }
        }
      }

      if (allPoints.length < 3) {
        csAlert('Could not extract shapes from SVG.');
        return;
      }

      // Normalize points to [-0.5, 0.5] range
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      for (const [x, y] of allPoints) {
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);
      }
      const rangeX = maxX - minX || 1;
      const rangeY = maxY - minY || 1;
      const normalized = allPoints.map(([x, y]) => [
        (x - minX) / rangeX - 0.5,
        -((y - minY) / rangeY - 0.5) // flip Y (SVG Y is inverted)
      ]);

      // Use the first closed path's points for the shape
      const firstPathShapes = SVGLoader.createShapes(data.paths[0]);
      if (firstPathShapes.length > 0) {
        const pts = firstPathShapes[0].getPoints(48);
        const norm = pts.map(p => [
          (p.x - minX) / rangeX - 0.5,
          -((p.y - minY) / rangeY - 0.5)
        ]);
        window.dispatchEvent(new CustomEvent('svg-shape-loaded', { detail: norm }));
      }
    } catch (err) {
      console.error('SVG parse error:', err);
      csAlert('Failed to parse SVG file.');
    }
  });
}

// Image silhouette import (Pro)
const imageSilhouetteInput = document.getElementById('image-silhouette-import');
if (imageSilhouetteInput) {
  imageSilhouetteInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!checkFileSize(file)) { imageSilhouetteInput.value = ''; return; }
    if (!isPro()) {
      imageSilhouetteInput.value = '';
      showUpgradeModal(FEATURES.imageSilhouette);
      return;
    }
    silhouetteImageFile = file;
    try {
      const threshold = state.imageThreshold || 128;
      const points = await traceImageSilhouette(file, { threshold });
      if (points.length < 3) {
        csAlert('Could not extract a silhouette from this image. Try adjusting the threshold.');
        return;
      }
      window.dispatchEvent(new CustomEvent('svg-shape-loaded', { detail: points }));
    } catch (err) {
      console.error('Image silhouette error:', err);
      csAlert('Failed to process image for silhouette.');
    }
  });
}

// Image relief / heightmap import (Pro)
const imageReliefInput = document.getElementById('image-relief-import');
if (imageReliefInput) {
  imageReliefInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!checkFileSize(file)) { imageReliefInput.value = ''; return; }
    if (!isPro()) {
      imageReliefInput.value = '';
      showUpgradeModal(FEATURES.imageRelief);
      return;
    }
    reliefImageFile = file;
    try {
      const heightmap = await createHeightmapData(file, {
        resolution: state.reliefResolution || 64,
        invert: state.reliefInvert || false
      });
      state.reliefData = heightmap;
      await rebuildPendant(state);
    } catch (err) {
      console.error('Image relief error:', err);
      csAlert('Failed to process image for relief.');
    }
  });
}

// STL pendant import (Pro)
const stlImportInput = document.getElementById('stl-import');
if (stlImportInput) {
  stlImportInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!checkFileSize(file)) { stlImportInput.value = ''; return; }
    if (!isPro()) {
      stlImportInput.value = '';
      showUpgradeModal(FEATURES.stlImport);
      return;
    }
    try {
      const buffer = await file.arrayBuffer();
      const loader = new STLLoader();
      const geometry = loader.parse(buffer);
      geometry.computeVertexNormals();
      state.customSTLGeometry = geometry;
      await rebuildPendant(state);
    } catch (err) {
      console.error('STL import error:', err);
      csAlert('Failed to load STL file.');
    }
  });
}

// Clear import buttons
document.getElementById('clear-svg')?.addEventListener('click', async () => {
  state.customShapePoints = null;
  state.pendantShape = 'rectangle';
  const shapeSelect = document.getElementById('shape-select');
  if (shapeSelect) shapeSelect.value = 'rectangle';
  const svgEl = document.getElementById('svg-import');
  if (svgEl) svgEl.value = '';
  await rebuildPendant(state);
});

document.getElementById('clear-stl')?.addEventListener('click', async () => {
  state.customSTLGeometry = null;
  const stlEl = document.getElementById('stl-import');
  if (stlEl) stlEl.value = '';
  await rebuildPendant(state);
});

document.getElementById('clear-silhouette')?.addEventListener('click', async () => {
  silhouetteImageFile = null;
  state.customShapePoints = null;
  state.pendantShape = 'rectangle';
  const shapeSelect = document.getElementById('shape-select');
  if (shapeSelect) shapeSelect.value = 'rectangle';
  const imgEl = document.getElementById('image-silhouette-import');
  if (imgEl) imgEl.value = '';
  await rebuildPendant(state);
});

document.getElementById('clear-relief')?.addEventListener('click', async () => {
  reliefImageFile = null;
  state.reliefData = null;
  const imgEl = document.getElementById('image-relief-import');
  if (imgEl) imgEl.value = '';
  await rebuildPendant(state);
});

// Hide corner radius slider for non-rectangle shapes
const cornerRadiusGroup = document.getElementById('plate-radius')?.closest('.control-group');
function updateCornerRadiusVisibility() {
  if (!cornerRadiusGroup) return;
  cornerRadiusGroup.style.display = state.pendantShape === 'rectangle' ? '' : 'none';
}
const shapeSelectEl = document.getElementById('shape-select');
if (shapeSelectEl) {
  shapeSelectEl.addEventListener('change', () => setTimeout(updateCornerRadiusVisibility, 0));
}
updateCornerRadiusVisibility();

// --- Undo/Redo ---
let undoRedoActive = false;

function applyUndoRedoSnap(snap) {
  if (!snap) return;
  undoRedoActive = true;
  Object.assign(state, snap);
  window.dispatchEvent(new CustomEvent('load-preset', { detail: snap }));
  undoRedoActive = false;
}

if (undoBtn) {
  undoBtn.addEventListener('click', () => applyUndoRedoSnap(undoRedo.undo(state)));
}
if (redoBtn) {
  redoBtn.addEventListener('click', () => applyUndoRedoSnap(undoRedo.redo(state)));
}

document.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
  if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
    e.preventDefault();
    applyUndoRedoSnap(undoRedo.undo(state));
  }
  if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
    e.preventDefault();
    applyUndoRedoSnap(undoRedo.redo(state));
  }
});

// Push state after each change (but not from undo/redo itself)
window.addEventListener('state-changed', (e) => {
  if (!undoRedoActive) {
    undoRedo.pushState(state, e.detail);
  }
});

// --- Share Design (URL) ---
function showToast(message) {
  const toast = document.createElement('div');
  toast.className = 'cs-toast';
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

if (shareBtn) {
  shareBtn.addEventListener('click', async () => {
    const url = stateToShareUrl(state);
    try {
      await navigator.clipboard.writeText(url);
      showToast('Share link copied to clipboard!');
    } catch {
      const safe = url.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
      await csAlert('Share this link:<br><input type="text" value="' + safe + '" style="width:100%;margin-top:8px;padding:6px;background:var(--bg-input);border:1px solid var(--border);border-radius:4px;color:var(--text);font-size:11px" onclick="this.select()" readonly>');
    }
  });
}

// --- Preview thumbnail in order modal ---
function capturePreviewThumbnail() {
  if (!orderPreviewWrap) return;
  orderPreviewWrap.innerHTML = '';
  renderer.render(scene, camera);
  const source = renderer.domElement;
  const canvas = document.createElement('canvas');
  const maxW = 280;
  const scale = maxW / source.width;
  canvas.width = maxW;
  canvas.height = Math.round(source.height * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  orderPreviewWrap.appendChild(canvas);
}

// Hook into order button to capture thumbnail when modal opens
if (orderBtn) {
  orderBtn.addEventListener('click', () => {
    setTimeout(capturePreviewThumbnail, 50);
  });
}

(async () => {
  await initPremium();

  // Load shared design from URL before init — merge into state so init() uses it
  const shared = loadStateFromUrl();
  if (shared) {
    Object.assign(state, shared);
    clearShareHash();
  }

  await init();

  // Sync UI controls to match loaded state (shared URL)
  if (shared) {
    window.dispatchEvent(new CustomEvent('sync-ui-only', { detail: state }));
  }

  // Push initial state into undo history
  undoRedo.pushState(state);
})();
