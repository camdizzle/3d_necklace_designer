import * as THREE from 'three';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';
import { createScene } from './scene.js';
import { loadChain, updateChainMaterial } from './chainLoader.js';
import { generatePendant, updateMaterialOnGroup, createMaterial } from './pendantGenerator.js';
import { takeScreenshot, computeDimensions } from './exporter.js';
import { initUI } from './ui.js';
import { DEFAULTS } from './constants.js';
import { traceImageSilhouette, createHeightmapData } from './imageProcessor.js';
import { initPremium, showExportModal } from './premium.js';
import { createUndoRedo } from './undoRedo.js';
import { csAlert, csConfirm, csPrompt } from './modal.js';
import { stateToShareUrl, loadStateFromUrl, clearShareHash } from './shareUrl.js';
import {
  buildExportGroup, exportModel, uploadModel, downloadBuffer, printabilityWarnings
} from './modelExport.js';
import {
  snapshot, hasUnsavableParts, designKey, designTitle, loadCart, saveCart, clearCart,
  loadSaved, addSaved, removeSaved, rememberSource, currentSource, MAX_CART_DESIGNS
} from './designStore.js';
import { capturePendant } from './capture.js';
import { openSheet, closeSheet, initSheet, el } from './sheet.js';
import { initFontPickers, syncFontPickers } from './fontPicker.js';
import { reportError, initErrorReporting } from './errors.js';
import { GALLERY } from '../data/gallery.js';

initErrorReporting();
rememberSource();

// First-party funnel counter (no cookies, no personal data).
function track(name) {
  try {
    const src = new URLSearchParams(window.location.search).get('utm_source') || undefined;
    fetch('/api/event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, src }),
      keepalive: true
    }).catch(() => {});
  } catch {}
}
track('designer_view');

// Chain styles that have a real mesh. Older share links may name a
// style that was only ever a placeholder; those fall back to Cuban.
const CHAIN_TYPES = ['cuban', 'twisted-star'];

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
const orderModalGo = document.getElementById('order-modal-go');
const orderModalCancel = document.getElementById('order-modal-cancel');
const orderModalPrice = document.getElementById('order-modal-price');
const orderDiscountNote = document.getElementById('order-discount-note');
const orderCommentsInput = document.getElementById('order-comments');

const undoRedo = createUndoRedo();
const shareBtn = document.getElementById('share-btn');
const undoBtn = document.getElementById('undo-btn');
const redoBtn = document.getElementById('redo-btn');

const { scene, camera, renderer, controls } = createScene(viewport);

let chainMesh = null;
let chainSize = null;
let chainInfo = null;
let pendantGroup = null;
let lastPendantCenterY = 0;
let lastDefaultZ = 0;
let lastDefaultX = 0;
let lastPendantWidth = 0;
let lastPendantHeight = 0;
let silhouetteImageFile = null;
let reliefImageFile = null;
const fixedDiameterInput = document.getElementById('fixed-diameter');
const clearFixedDiameterBtn = document.getElementById('clear-fixed-diameter');

// Owner bypass — visit /design/#bypass=<key> to export without paying.
// The key rides in the URL fragment (never sent to the server or its
// logs) and is checked with a POST.
let adminBypass = sessionStorage.getItem('admin_bypass') === '1';
function checkBypassLink() {
  const url = new URL(window.location.href);
  const hashMatch = url.hash.match(/^#bypass=(.+)$/);
  const bp = hashMatch ? decodeURIComponent(hashMatch[1]) : url.searchParams.get('bypass');
  if (!bp) return;
  url.searchParams.delete('bypass');
  if (hashMatch) url.hash = '';
  window.history.replaceState({}, '', url.toString());
  fetch('/api/verify-bypass', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key: bp })
  })
    .then(r => r.json())
    .then(d => {
      if (d.valid) {
        sessionStorage.setItem('admin_bypass', '1');
        adminBypass = true;
      }
    })
    .catch(() => {});
}
checkBypassLink();
window.addEventListener('hashchange', checkBypassLink);

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

let loadedChainType = null;

// Load the chain for this design if it isn't the one on screen, then
// apply its size, visibility and colour.
async function ensureChain(st) {
  if (!CHAIN_TYPES.includes(st.chainType)) st.chainType = 'cuban';
  if (!chainMesh || loadedChainType !== st.chainType) {
    const matKey = st.twoTone ? st.chainMaterial : st.material;
    const chain = await loadChain(matKey || DEFAULTS.material, st.chainType);
    if (chainMesh) {
      scene.remove(chainMesh);
      chainMesh.geometry.dispose();
      chainMesh.material.dispose();
    }
    chainMesh = chain.mesh;
    chainSize = chain.size;
    chainInfo = {
      innerTopY: chain.innerTopY,
      innerBottomY: chain.innerBottomY,
      bailHeight: chain.bailHeight,
      chainThickness: chain.chainThickness,
      bailZCenter: chain.bailZCenter,
      bailXCenter: chain.bailXCenter
    };
    scene.add(chainMesh);
    loadedChainType = st.chainType;
  }
  chainMesh.scale.setScalar(st.chainScale);
  chainMesh.visible = !st.hideChain;
  applyChainMaterial(st);
}

// Rebuild everything from the current settings (presets, undo, examples,
// saved designs, and each design in an order at checkout).
async function applyFullState(st) {
  await ensureChain(st);
  await rebuildPendant(st);
  scene.background = new THREE.Color(st.backgroundColor || DEFAULTS.backgroundColor);
  controls.autoRotate = !!st.autoRotate;
  updateDimensions();
  updateShapeVisibility();
  syncFontPickers();
}

async function init() {
  try {
    await ensureChain(state);
    await rebuildPendant(state);
    frameCamera();
    loading.classList.add('hidden');
    updateDimensions();
  } catch (err) {
    console.error('Failed to load:', err);
    reportError(`Designer failed to load: ${err && err.message ? err.message : err}`, 'init');
    loading.querySelector('p').textContent = 'The chain model did not load. Please refresh the page.';
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
    lastDefaultX + state.pendantOffsetX,
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

  try {
  const scale = state.chainScale;
  const scaledChainInfo = chainInfo ? {
    innerTopY: chainInfo.innerTopY * scale,
    innerBottomY: chainInfo.innerBottomY * scale,
    bailHeight: chainInfo.bailHeight * scale,
    chainThickness: chainInfo.chainThickness * scale,
    bailZCenter: (chainInfo.bailZCenter || 0) * scale,
    bailXCenter: (chainInfo.bailXCenter || 0) * scale
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
    chainType: state.chainType,
    outlineBaseDepth: state.outlineBaseDepth,
    outlineRaisedDepth: state.outlineRaisedDepth,
    outlineWidth: state.outlineWidth,
    outlineBottomColor: state.outlineBottomColor
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
  lastDefaultX = result.defaultX || 0;
  lastPendantWidth = result.width || 0;
  lastPendantHeight = result.height || 0;

  applyFixedDiameter(state);
  applyPendantTransform(state);

  scene.add(pendantGroup);
  updateDimensions();
  } catch (err) {
    console.error('Pendant rebuild failed:', err);
    reportError(`Pendant rebuild failed: ${err && err.message ? err.message : err}`, 'rebuildPendant');
  }
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
      if (newState.chainType === 'twisted-star') {
        newState.pendantOffsetX = 0;
        newState.pendantOffsetY = -3;
        newState.pendantOffsetZ = 2;
      } else {
        newState.pendantOffsetX = 1;
        newState.pendantOffsetY = -4;
        newState.pendantOffsetZ = 2;
      }
      await ensureChain(newState);
      window.dispatchEvent(new CustomEvent('sync-ui-only', { detail: newState }));
      await rebuildPendant(newState);
    } catch (err) {
      console.error('Failed to load chain:', err);
      reportError(`Chain failed to load: ${err && err.message ? err.message : err}`, 'chainType');
    }
    return;
  }

  // Presets, undo/redo, examples, saved designs and Reset All replace
  // every setting at once, including the chain.
  if (changedKey === 'reset') {
    await applyFullState(newState);
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

// Persist the current design before a Stripe redirect so the user
// returns to the exact model they designed (to tweak / buy again).
// Captured before the redirect handlers below clear the URL params.
const PENDING_DESIGN_KEY = 'necklace_pending_design';
const RETURNED_FROM_STRIPE = (() => {
  const p = new URLSearchParams(window.location.search);
  return p.has('export') || p.has('order');
})();

function savePendingDesign() {
  try {
    const snap = { ...state };
    delete snap.reliefData;        // Float32Array — not safely serializable
    delete snap.customSTLGeometry; // BufferGeometry — not serializable
    localStorage.setItem(PENDING_DESIGN_KEY, JSON.stringify(snap));
  } catch {}
}

function loadPendingDesign() {
  try {
    const raw = localStorage.getItem(PENDING_DESIGN_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function clearPendingDesign() {
  try { localStorage.removeItem(PENDING_DESIGN_KEY); } catch {}
}

function designNameParts() {
  return [state.text, state.secondLineText, state.thirdLineText].filter(Boolean);
}

function buildModel(format) {
  const group = buildExportGroup(chainMesh, pendantGroup);
  return exportModel(group, format, designNameParts().join(' ') || 'Chain Studio design');
}

function warningsHtml() {
  const warnings = printabilityWarnings(state, computeDimensions(pendantGroup));
  if (warnings.length === 0) return '';
  return '<div class="print-warnings"><strong>Print check</strong><ul>' +
    warnings.map(w => `<li>${esc(w)}</li>`).join('') + '</ul></div>';
}

// Export ($2 per download via Stripe — skipped for the owner bypass)
if (exportBtn) exportBtn.addEventListener('click', async () => {
  if (!pendantGroup) {
    await csAlert('No pendant to export.');
    return;
  }
  const format = state.exportFormat === '3mf' ? '3mf' : 'stl';
  track('export_click');
  if (adminBypass) {
    const stem = designNameParts().join('_').replace(/[^A-Za-z0-9]+/g, '_').toLowerCase() || 'necklace';
    downloadBuffer(buildModel(format), `${stem}_necklace.${format}`);
    return;
  }
  showExportModal(async () => {
    try {
      const uploadId = await uploadModel(buildModel(format), format);
      const designName = designNameParts().join(' / ') || 'necklace';
      const res = await fetch('/api/export-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uploadId, designName, format, source: currentSource() })
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Server error' }));
        throw new Error(err.error || 'Checkout failed');
      }

      const { url } = await res.json();
      savePendingDesign();
      window.location.href = url;
    } catch (err) {
      console.error('Export checkout failed:', err);
      await csAlert('Failed to start checkout: ' + err.message);
      const buyBtn = document.getElementById('export-modal-buy');
      if (buyBtn) { buyBtn.disabled = false; buyBtn.textContent = 'Pay & Download'; }
    }
  }, { format, warningsHtml: warningsHtml() });
});

// Screenshot — always watermark-free
if (screenshotBtn) {
  screenshotBtn.addEventListener('click', () => {
    track('screenshot');
    takeScreenshot(renderer, scene, camera, { watermark: false });
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

// Order pricing: $25 each; every 4th chain in the order is free, across
// all designs (the server computes the real price).
const UNIT_PRICE = 2500; // cents

function computeOrderPricing(qty) {
  const freeItems = Math.floor(qty / 4);
  const paidItems = qty - freeItems;
  const totalCents = paidItems * UNIT_PRICE;
  const fullPrice = qty * UNIT_PRICE;
  const savings = fullPrice - totalCents;
  return { totalCents, paidItems, freeItems, savings };
}

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
  if (st.useCustomColor && st.customColor) parts.push(`Pendant color: ${st.customColor}`);
  if (st.pendantShape === 'outline' && st.outlineBottomColor) parts.push(`Outline base color: ${st.outlineBottomColor}`);
  parts.push(`Chain: ${st.chainType === 'twisted-star' ? 'Twisted Star' : 'Cuban link'}, ${st.material}${st.twoTone ? ` + ${st.chainMaterial} (two-tone)` : ''}`);
  if (st.matteFinish) parts.push('Finish: matte');
  if (st.engrave) parts.push('Engraved text');
  return parts.join('\n');
}

function pendantPicture(opts) {
  return capturePendant({ renderer, scene, camera, controls, target: pendantGroup }, opts);
}

let cart = loadCart();

function cartQuantity() {
  return cart.reduce((n, it) => n + (it.quantity || 1), 0);
}

function updateCartBadge() {
  const badge = document.getElementById('cart-count');
  if (!badge) return;
  const designs = cart.length;
  badge.hidden = designs === 0;
  badge.textContent = designs ? String(cartQuantity()) : '';
  orderBtn?.setAttribute('aria-label', designs
    ? `Your order: ${cartQuantity()} chain${cartQuantity() === 1 ? '' : 's'}`
    : 'Order this chain printed');
}

// Turn the design on screen into an order item.
async function makeCartItem() {
  const snap = snapshot(state);
  const item = {
    id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    key: designKey(snap),
    state: snap,
    designName: designTitle(state),
    designDetails: buildDesignDetails(state),
    shareUrl: stateToShareUrl(state),
    thumb: pendantPicture({ width: 192, height: 144, quality: 0.72 }),
    warnings: printabilityWarnings(state, computeDimensions(pendantGroup)),
    quantity: 1
  };
  // An image relief or imported STL can't be rebuilt from saved
  // settings, so upload this design's model now.
  if (hasUnsavableParts(state)) {
    item.uploadId = await uploadModel(buildModel('stl'), 'stl');
    item.uploadedAt = Date.now();
  }
  return item;
}

function currentInCart() {
  const key = designKey(snapshot(state));
  return cart.some((it) => it.key === key);
}

async function addCurrentToCart() {
  if (!pendantGroup) return false;
  if (currentInCart()) return true;
  if (cart.length >= MAX_CART_DESIGNS) {
    await csAlert(`An order can hold up to ${MAX_CART_DESIGNS} designs.`);
    return false;
  }
  try {
    cart.push(await makeCartItem());
  } catch (err) {
    await csAlert('Could not add this design: ' + err.message);
    return false;
  }
  if (!saveCart(cart)) showToast('Your order is too large to keep after a reload.');
  updateCartBadge();
  return true;
}

function renderCart() {
  const list = document.getElementById('cart-items');
  const addBtn = document.getElementById('cart-add-current');
  if (!list) return;
  list.innerHTML = '';
  if (addBtn) addBtn.hidden = !pendantGroup || currentInCart() || cart.length >= MAX_CART_DESIGNS;

  if (cart.length === 0) {
    list.appendChild(el('p', { class: 'cs-empty' }, 'Your order is empty.'));
  }
  cart.forEach((it, i) => {
    const qty = el('span', {}, String(it.quantity || 1));
    const change = (d) => {
      it.quantity = Math.min(99, Math.max(1, (it.quantity || 1) + d));
      saveCart(cart);
      renderCart();
      updateCartBadge();
    };
    list.appendChild(el('div', { class: 'cart-item' },
      it.thumb ? el('img', { src: it.thumb, alt: `Preview of ${it.designName}` }) : el('div', {}),
      el('div', {},
        el('div', { class: 'cart-item-name' }, it.designName),
        it.warnings && it.warnings.length
          ? el('div', { class: 'cart-item-warn', title: it.warnings.join('\n') }, `Print check: ${it.warnings.length} note${it.warnings.length > 1 ? 's' : ''}`)
          : null,
        el('div', { class: 'cart-item-meta' },
          el('button', { type: 'button', onclick: () => editCartItem(i) }, 'Edit'),
          el('button', { type: 'button', onclick: () => { cart.splice(i, 1); saveCart(cart); renderCart(); updateCartBadge(); } }, 'Remove'))
      ),
      el('div', { class: 'cart-qty' },
        el('button', { type: 'button', 'aria-label': 'One fewer', onclick: () => change(-1) }, '−'),
        qty,
        el('button', { type: 'button', 'aria-label': 'One more', onclick: () => change(1) }, '+'))
    ));
  });

  const qty = cartQuantity();
  const { totalCents, freeItems, savings } = computeOrderPricing(qty);
  orderModalPrice.innerHTML = qty
    ? `$${(totalCents / 100).toFixed(2)} <span>for ${qty} chain${qty > 1 ? 's' : ''} + free shipping</span>`
    : '';
  const note = document.getElementById('order-discount-note');
  if (note) {
    note.textContent = freeItems > 0
      ? `${freeItems} free chain${freeItems > 1 ? 's' : ''}: you save $${(savings / 100).toFixed(2)}`
      : qty > 0 ? `Add ${4 - (qty % 4)} more for a free chain. Different names are fine.` : '';
  }
  if (orderModalGo) {
    orderModalGo.disabled = qty === 0;
    orderModalGo.textContent = 'Checkout';
  }
}

async function editCartItem(i) {
  const it = cart[i];
  if (!it) return;
  cart.splice(i, 1);
  saveCart(cart);
  updateCartBadge();
  orderModal.classList.remove('open');
  window.dispatchEvent(new CustomEvent('load-preset', { detail: { ...DEFAULTS, ...it.state, reliefData: null, customSTLGeometry: null } }));
  showToast('Loaded into the designer. Press Order to add it back.');
}

async function openCart() {
  track('order_click');
  if (cart.length === 0) await addCurrentToCart();
  renderCart();
  orderModal.classList.add('open');
}

if (orderBtn) orderBtn.addEventListener('click', () => { openCart(); });
document.getElementById('cart-add-current')?.addEventListener('click', async () => {
  await addCurrentToCart();
  renderCart();
});

function setLoadingMessage(text) {
  loading.querySelector('p').textContent = text;
  loading.classList.toggle('hidden', !text);
}

// Build and upload a model for every design in the order, then go to
// Stripe. Designs are rebuilt one by one in the 3D view (behind a
// "Preparing" screen) and the design on screen is restored afterwards.
async function checkoutCart() {
  if (!cart.length) return;
  const STALE_MS = 3.5 * 60 * 60 * 1000;
  const stale = cart.find((it) => it.uploadId && Date.now() - (it.uploadedAt || 0) > STALE_MS);
  if (stale) {
    await csAlert(`"${esc(stale.designName)}" uses an uploaded image or STL and was added too long ago. Remove it, reopen that design and add it again.`);
    return;
  }

  orderModalGo.disabled = true;
  const live = { ...state };
  const items = [];
  try {
    for (let i = 0; i < cart.length; i++) {
      const it = cart[i];
      orderModalGo.textContent = `Preparing design ${i + 1} of ${cart.length}…`;
      let uploadId = it.uploadId;
      if (!uploadId) {
        setLoadingMessage(`Preparing your order (${i + 1} of ${cart.length})…`);
        Object.assign(state, { ...DEFAULTS, ...it.state, reliefData: null, customSTLGeometry: null });
        await applyFullState(state);
        uploadId = await uploadModel(buildModel('stl'), 'stl');
      }
      items.push({
        uploadId, format: 'stl', designName: it.designName, designDetails: it.designDetails,
        shareUrl: it.shareUrl, quantity: it.quantity || 1
      });
    }
  } catch (err) {
    console.error('Order preparation failed:', err);
    reportError(`Order preparation failed: ${err.message}`, 'checkout');
    await csAlert('Failed to prepare your order: ' + err.message);
    orderModalGo.disabled = false;
    orderModalGo.textContent = 'Checkout';
    return;
  } finally {
    Object.assign(state, live);
    await applyFullState(state);
    window.dispatchEvent(new CustomEvent('sync-ui-only', { detail: state }));
    setLoadingMessage('');
  }

  try {
    orderModalGo.textContent = 'Opening checkout…';
    const res = await fetch('/api/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items,
        comments: orderCommentsInput?.value?.trim() || '',
        source: currentSource()
      })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Server error' }));
      throw new Error(err.error || 'Checkout failed');
    }
    const { url } = await res.json();
    savePendingDesign();
    window.location.href = url;
  } catch (err) {
    console.error('Order failed:', err);
    await csAlert('Failed to start checkout: ' + err.message);
    orderModalGo.disabled = false;
    orderModalGo.textContent = 'Checkout';
  }
}

if (orderModalGo) orderModalGo.addEventListener('click', () => { checkoutCart(); });

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
    if (orderStatus === 'success') {
      clearCart();
      cart = [];
    }
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

// Handle export success/cancel URL params (redirect back from Stripe)
{
  const params = new URLSearchParams(window.location.search);
  const exportStatus = params.get('export');
  if (exportStatus === 'success') {
    const eid = /^[a-f0-9]+$/.test(params.get('eid') || '') ? params.get('eid') : null;
    // Keep ?export=success&eid=… in the URL until the download has
    // started, so a refresh can retry it.

    if (eid) {
      // Webhook may not have fired yet — retry a few times with backoff
      async function attemptDownload(retries, delay) {
        const res = await fetch(`/api/export-download/${eid}`);
        if (res.ok) {
          const cd = res.headers.get('Content-Disposition') || '';
          const name = (cd.match(/filename="?([^";]+)"?/) || [])[1] || 'necklace.stl';
          downloadBuffer(await res.arrayBuffer(), name);
          const clean = new URL(window.location.href);
          clean.searchParams.delete('export');
          clean.searchParams.delete('eid');
          window.history.replaceState({}, '', clean.toString());
          return;
        }
        if (res.status === 402 && retries > 0) {
          await new Promise(r => setTimeout(r, delay));
          return attemptDownload(retries - 1, delay * 2);
        }
        console.error('Export download failed:', res.status);
        csAlert('Your payment went through, but the download did not start. ' +
          'Refresh this page to try again, or contact us with this reference: ' + esc(eid));
      }
      attemptDownload(5, 1500);
    }

    const toast = document.createElement('div');
    toast.className = 'order-toast success';
    toast.textContent = 'Export purchased! Your download should start automatically.';
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 6000);
  } else if (exportStatus === 'cancelled') {
    const url = new URL(window.location.href);
    url.searchParams.delete('export');
    window.history.replaceState({}, '', url.toString());

    const toast = document.createElement('div');
    toast.className = 'order-toast cancelled';
    toast.textContent = 'Export cancelled. Your design is still here.';
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

// Save design / My designs (kept in this browser)
if (savePresetBtn) {
  savePresetBtn.addEventListener('click', async () => {
    const name = await csPrompt('Name this design:', designTitle(state));
    if (!name) return;
    const ok = addSaved({
      id: `d${Date.now().toString(36)}`,
      name: String(name).slice(0, 60),
      state: snapshot(state),
      thumb: pendantPicture({ width: 320, height: 240, quality: 0.72 }),
      savedAt: new Date().toISOString()
    });
    showToast(ok ? 'Saved to My designs.' : 'Could not save: this browser\'s storage is full.');
    if (hasUnsavableParts(state)) showToast('Note: uploaded images and STL files are not saved with designs.');
  });
}

function loadDesignIntoView(designState) {
  window.dispatchEvent(new CustomEvent('load-preset', {
    detail: { ...DEFAULTS, ...designState, reliefData: null, customSTLGeometry: null }
  }));
}

function showMyDesigns() {
  const saved = loadSaved();
  const grid = el('div', { class: 'cs-grid' });
  if (!saved.length) {
    openSheet('My designs', el('p', { class: 'cs-empty' }, 'Nothing saved yet. Use "Save design" to keep a design in this browser.'));
    return;
  }
  for (const d of saved) {
    grid.appendChild(el('div', { class: 'cs-tile' },
      d.thumb ? el('img', { src: d.thumb, alt: `Preview of ${d.name}` }) : el('img', { alt: '', src: '/favicon.svg' }),
      el('div', { class: 'cs-tile-body' },
        el('strong', {}, d.name),
        d.savedAt ? new Date(d.savedAt).toLocaleDateString() : 'Saved preset'),
      el('div', { class: 'cs-tile-actions' },
        el('button', { type: 'button', onclick: () => { closeSheet(); loadDesignIntoView(d.state); } }, 'Open'),
        el('button', { type: 'button', onclick: async () => {
          if (await csConfirm(`Delete "${esc(d.name)}"?`)) { removeSaved(d.id); showMyDesigns(); }
        } }, 'Delete'))
    ));
  }
  openSheet('My designs', el('div', {},
    el('p', { class: 'cs-empty' }, 'Saved in this browser only.'), grid));
}

if (loadPresetBtn) loadPresetBtn.addEventListener('click', showMyDesigns);

// ---------- Start from an example ----------
function showExamples() {
  const grid = el('div', { class: 'cs-grid' });
  for (const g of GALLERY) {
    grid.appendChild(el('button', {
      type: 'button', class: 'cs-tile',
      onclick: async () => {
        if (!(await csConfirm(`Replace the design on screen with "${esc(g.title)}"?`))) return;
        closeSheet();
        loadDesignIntoView(g.state);
      }
    },
      el('img', { src: `/gallery/${g.slug}-close.jpg`, alt: g.title, loading: 'lazy' }),
      el('div', { class: 'cs-tile-body' }, el('strong', {}, g.title), g.blurb)));
  }
  openSheet('Start from an example', grid);
}
document.getElementById('examples-btn')?.addEventListener('click', showExamples);

// ---------- Advanced settings switch ----------
{
  const toggle = document.getElementById('advanced-toggle');
  let on = false;
  try { on = localStorage.getItem('cs_advanced') === '1'; } catch {}
  document.body.classList.toggle('show-advanced', on);
  if (toggle) {
    toggle.checked = on;
    toggle.addEventListener('change', () => {
      document.body.classList.toggle('show-advanced', toggle.checked);
      try { localStorage.setItem('cs_advanced', toggle.checked ? '1' : '0'); } catch {}
    });
  }
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

// Hide corner radius slider for non-rectangle shapes and toggle outline controls
const cornerRadiusGroup = document.getElementById('plate-radius')?.closest('.control-group');
const outlineControlsEl = document.getElementById('outline-controls');
function updateShapeVisibility() {
  const isOutline = state.pendantShape === 'outline';
  if (cornerRadiusGroup) cornerRadiusGroup.style.display = state.pendantShape === 'rectangle' ? '' : 'none';
  if (outlineControlsEl) outlineControlsEl.style.display = isOutline ? '' : 'none';
  document.querySelectorAll('.hide-in-outline').forEach(el => {
    el.style.display = isOutline ? 'none' : '';
  });
}
const shapeSelectEl = document.getElementById('shape-select');
if (shapeSelectEl) {
  shapeSelectEl.addEventListener('change', () => setTimeout(updateShapeVisibility, 0));
}
updateShapeVisibility();

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

async function shortShareUrl(longUrl) {
  const i = longUrl.indexOf('#design=');
  if (i === -1) return longUrl; // the default design: no need for a link
  try {
    const res = await fetch('/api/share', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        design: longUrl.slice(i + 8),
        image: pendantPicture({ width: 1200, height: 630, quality: 0.82, pad: 2.5 })
      })
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()).url || longUrl;
  } catch {
    return longUrl;
  }
}

if (shareBtn) {
  shareBtn.addEventListener('click', async () => {
    track('share');
    shareBtn.disabled = true;
    const url = await shortShareUrl(stateToShareUrl(state));
    shareBtn.disabled = false;
    try {
      await navigator.clipboard.writeText(url);
      showToast('Share link copied to clipboard!');
    } catch {
      const safe = url.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
      await csAlert('Share this link:<br><input type="text" value="' + safe + '" style="width:100%;margin-top:8px;padding:6px;background:var(--bg-input);border:1px solid var(--border);border-radius:4px;color:var(--text);font-size:11px" onclick="this.select()" readonly>');
    }
  });
}

initSheet();
initFontPickers();
updateCartBadge();

(async () => {
  await initPremium();

  // Restore state before init so init() builds the right model.
  // A shared URL takes priority; otherwise, if we just returned from a
  // Stripe redirect, restore the design the user was working on.
  const shared = loadStateFromUrl();
  let restored = shared;
  if (shared) {
    clearShareHash();
  } else if (RETURNED_FROM_STRIPE) {
    restored = loadPendingDesign();
  }
  if (!RETURNED_FROM_STRIPE) clearPendingDesign();
  if (restored) {
    Object.assign(state, restored);
  }
  if (!CHAIN_TYPES.includes(state.chainType)) state.chainType = 'cuban';

  await init();

  // Sync UI controls to match the restored state
  if (restored) {
    window.dispatchEvent(new CustomEvent('sync-ui-only', { detail: state }));
  }
  syncFontPickers();

  // Push initial state into undo history
  undoRedo.pushState(state);

  // Hook for automated renders (scripts/render-gallery.js).
  window.__chainStudio = {
    scene, camera, controls, renderer, state, ready: true,
    get pendant() { return pendantGroup; },
    get chain() { return chainMesh; }
  };
})();
