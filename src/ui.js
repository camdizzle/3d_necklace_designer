import { DEFAULTS } from './constants.js';
import {
  isPro,
  showUpgradeModal,
  FEATURES,
  PREMIUM_FONTS,
  PREMIUM_SHAPES,
  PREMIUM_MATERIALS
} from './premium.js';

export function initUI(onChange) {
  const state = { ...DEFAULTS };

  // ------------------------------------------------------------
  // Premium gating helpers
  // ------------------------------------------------------------

  /**
   * Wire a <select> so picking a premium-only option reverts to the
   * last free value and shows the upgrade modal. Also tags premium
   * options with a CSS class so they render with a lock icon.
   */
  function gatePremiumSelect(selectId, premiumValues, featureLabel, onValid) {
    const el = document.getElementById(selectId);
    if (!el) return;

    // Tag premium options visually.
    Array.from(el.options).forEach((opt) => {
      if (premiumValues.has(opt.value)) {
        opt.classList.add('premium-option');
      }
    });

    let lastValid = el.value;
    el.addEventListener('change', (event) => {
      if (premiumValues.has(el.value) && !isPro()) {
        event.preventDefault();
        event.stopPropagation();
        el.value = lastValid;
        showUpgradeModal(featureLabel);
        return;
      }
      lastValid = el.value;
      onValid(el.value);
    }, true); // capture to run before other listeners
  }

  /**
   * Wire a checkbox so ticking it when not pro snaps it back off and
   * shows the upgrade modal.
   */
  function gatePremiumCheckbox(checkboxId, featureLabel, stateKey) {
    const el = document.getElementById(checkboxId);
    if (!el) return;
    el.addEventListener('change', (event) => {
      if (el.checked && !isPro()) {
        event.preventDefault();
        event.stopPropagation();
        el.checked = false;
        state[stateKey] = false;
        showUpgradeModal(featureLabel);
        return;
      }
      state[stateKey] = el.checked;
      onChange(state, stateKey);
    }, true);
  }

  /**
   * Wire a file <input> so opening the picker is blocked when not pro.
   * File inputs are tricky: we gate on the pointerdown/click of the
   * *wrapper* (since the actual input is invisible), and also guard the
   * change event for users who trigger it programmatically.
   */
  function gatePremiumFileInput(inputId, featureLabel) {
    const el = document.getElementById(inputId);
    if (!el) return;
    // Block the click that opens the native picker.
    el.addEventListener('click', (event) => {
      if (!isPro()) {
        event.preventDefault();
        event.stopPropagation();
        showUpgradeModal(featureLabel);
      }
    }, true);
    // Defense-in-depth: if somehow a file is set, drop it.
    el.addEventListener('change', (event) => {
      if (!isPro()) {
        event.preventDefault();
        event.stopPropagation();
        el.value = '';
        showUpgradeModal(featureLabel);
      }
    }, true);
  }

  // --- Collapsible sections ---
  // Auto-wrap each .section's non-title children in a .section-body and wire up
  // click-to-collapse on the section title. Persists state to localStorage.
  const COLLAPSE_KEY = 'necklace_section_collapse';
  let collapseState = {};
  try {
    collapseState = JSON.parse(localStorage.getItem(COLLAPSE_KEY) || '{}');
  } catch {}
  const saveCollapseState = () => {
    try { localStorage.setItem(COLLAPSE_KEY, JSON.stringify(collapseState)); } catch {}
  };

  document.querySelectorAll('#panel .section').forEach((section) => {
    const title = section.querySelector('.section-title');
    if (!title) return;
    // Wrap everything after the title in a .section-body div
    const body = document.createElement('div');
    body.className = 'section-body';
    let node = title.nextSibling;
    while (node) {
      const next = node.nextSibling;
      body.appendChild(node);
      node = next;
    }
    section.appendChild(body);

    const sectionId = title.textContent.trim();
    if (collapseState[sectionId]) section.classList.add('collapsed');

    title.addEventListener('click', () => {
      section.classList.toggle('collapsed');
      collapseState[sectionId] = section.classList.contains('collapsed');
      saveCollapseState();
    });
  });

  // --- Helpers ---
  function bindSlider(id, key, transform = parseFloat) {
    const slider = document.getElementById(id);
    const valEl = document.getElementById(id + '-val');
    if (!slider) return;
    slider.addEventListener('input', () => {
      const val = transform(slider.value);
      state[key] = val;
      if (valEl) valEl.textContent = val;
      onChange(state, key);
    });
  }

  function bindCheckbox(id, key) {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('change', () => {
      state[key] = el.checked;
      onChange(state, key);
    });
  }

  function bindTextInput(id, key) {
    const el = document.getElementById(id);
    if (!el) return;
    let debounce;
    el.addEventListener('input', () => {
      clearTimeout(debounce);
      debounce = setTimeout(() => {
        state[key] = el.value;
        onChange(state, key);
      }, 300);
    });
  }

  function bindSelect(id, key) {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('change', () => {
      state[key] = el.value;
      onChange(state, key);
    });
  }

  function bindLineColor(toggleId, colorId, rowId, stateKey) {
    const toggle = document.getElementById(toggleId);
    const colorInput = document.getElementById(colorId);
    const row = document.getElementById(rowId);
    if (!toggle || !colorInput) return;

    toggle.addEventListener('change', () => {
      if (row) row.style.display = toggle.checked ? '' : 'none';
      state[stateKey] = toggle.checked ? colorInput.value : null;
      onChange(state, stateKey);
    });

    colorInput.addEventListener('input', () => {
      if (!toggle.checked) return;
      state[stateKey] = colorInput.value;
      onChange(state, stateKey);
    });
  }

  // --- Line 1 ---
  const textInput = document.getElementById('text-input');
  let textDebounce;
  textInput.addEventListener('input', () => {
    clearTimeout(textDebounce);
    textDebounce = setTimeout(() => {
      state.text = textInput.value;
      onChange(state, 'text');
    }, 300);
  });
  gatePremiumSelect('font-select', PREMIUM_FONTS, FEATURES.scriptFont, (val) => {
    state.font = val;
    onChange(state, 'font');
  });
  bindSlider('text-size', 'textSize', parseFloat);
  bindSlider('text-curve', 'textCurve', parseFloat);
  bindSlider('text-offset-x', 'textOffsetX', parseFloat);
  bindSlider('text-offset-y', 'textOffsetY', parseFloat);
  bindSlider('letter-spacing', 'letterSpacing', parseFloat);
  bindSlider('extrude-depth', 'extrudeDepth', parseFloat);
  bindCheckbox('bevel-toggle', 'bevelEnabled');
  bindCheckbox('align-to-plate-toggle', 'alignToPlate');
  bindLineColor('line1-color-toggle', 'line1-color', 'line1-color-row', 'lineColor1');

  // --- Line 2 ---
  bindTextInput('second-line-input', 'secondLineText');
  gatePremiumSelect('second-line-font', PREMIUM_FONTS, FEATURES.scriptFont, (val) => {
    state.secondLineFont = val;
    onChange(state, 'secondLineFont');
  });
  bindSlider('second-line-size', 'secondLineSize', parseFloat);
  bindSlider('second-line-curve', 'secondLineCurve', parseFloat);
  bindSlider('second-line-offset-x', 'secondLineOffsetX', parseFloat);
  bindSlider('second-line-offset-y', 'secondLineOffsetY', parseFloat);
  bindSlider('second-line-letter-spacing', 'secondLineLetterSpacing', parseFloat);
  bindSlider('second-line-extrude-depth', 'secondLineExtrudeDepth', parseFloat);
  bindCheckbox('second-line-bevel-toggle', 'secondLineBevelEnabled');
  bindCheckbox('second-line-align-to-plate-toggle', 'secondLineAlignToPlate');
  bindLineColor('line2-color-toggle', 'line2-color', 'line2-color-row', 'lineColor2');

  // --- Line 3 ---
  bindTextInput('third-line-input', 'thirdLineText');
  gatePremiumSelect('third-line-font', PREMIUM_FONTS, FEATURES.scriptFont, (val) => {
    state.thirdLineFont = val;
    onChange(state, 'thirdLineFont');
  });
  bindSlider('third-line-size', 'thirdLineSize', parseFloat);
  bindSlider('third-line-curve', 'thirdLineCurve', parseFloat);
  bindSlider('third-line-offset-x', 'thirdLineOffsetX', parseFloat);
  bindSlider('third-line-offset-y', 'thirdLineOffsetY', parseFloat);
  bindSlider('third-line-letter-spacing', 'thirdLineLetterSpacing', parseFloat);
  bindSlider('third-line-extrude-depth', 'thirdLineExtrudeDepth', parseFloat);
  bindCheckbox('third-line-bevel-toggle', 'thirdLineBevelEnabled');
  bindCheckbox('third-line-align-to-plate-toggle', 'thirdLineAlignToPlate');
  bindLineColor('line3-color-toggle', 'line3-color', 'line3-color-row', 'lineColor3');

  // --- Shared text layout ---
  bindSlider('line-spacing', 'lineSpacing', parseFloat);
  bindSelect('text-alignment', 'textAlignment');
  gatePremiumCheckbox('engrave-toggle', FEATURES.engrave, 'engrave');

  // --- Plate ---
  bindCheckbox('lock-pendant-size', 'lockPendantSize');
  bindSlider('plate-padding', 'platePadding', parseInt);
  bindSlider('plate-radius', 'plateRadius', parseInt);
  bindSlider('plate-thickness', 'plateThickness', parseFloat);
  // Border is premium: intercept on input/change so any non-zero value gates.
  const borderSlider = document.getElementById('border-width');
  const borderVal = document.getElementById('border-width-val');
  if (borderSlider) {
    borderSlider.addEventListener('input', (event) => {
      const val = parseFloat(borderSlider.value);
      if (val > 0 && !isPro()) {
        event.preventDefault();
        event.stopPropagation();
        borderSlider.value = 0;
        if (borderVal) borderVal.textContent = '0';
        state.borderWidth = 0;
        showUpgradeModal(FEATURES.border);
        return;
      }
      state.borderWidth = val;
      if (borderVal) borderVal.textContent = val;
      onChange(state, 'borderWidth');
    }, true);
  }

  // --- Shape ---
  const shapeSelect = document.getElementById('shape-select');
  gatePremiumSelect('shape-select', PREMIUM_SHAPES, FEATURES.premiumShape, (val) => {
    state.pendantShape = val;
    onChange(state, 'pendantShape');
  });

  // --- Pendant position ---
  bindSlider('pendant-scale', 'pendantScale', parseFloat);
  bindSlider('pendant-offset-x', 'pendantOffsetX', parseFloat);
  bindSlider('pendant-offset-y', 'pendantOffsetY', parseFloat);
  bindSlider('pendant-offset-z', 'pendantOffsetZ', parseFloat);

  // --- Chain ---
  bindSelect('chain-type-select', 'chainType');
  bindSlider('chain-scale', 'chainScale', parseFloat);
  bindCheckbox('hide-chain-toggle', 'hideChain');

  // --- Image ---
  bindSlider('image-threshold', 'imageThreshold', parseInt);
  bindSlider('relief-height', 'reliefHeight', parseFloat);
  bindSlider('relief-resolution', 'reliefResolution', parseInt);
  bindCheckbox('relief-invert-toggle', 'reliefInvert');

  // --- Material ---
  const customColorInput = document.getElementById('custom-color');
  const useCustomColorToggle = document.getElementById('use-custom-color');
  if (customColorInput) {
    customColorInput.addEventListener('input', () => {
      state.customColor = customColorInput.value;
      if (state.useCustomColor) onChange(state, 'customColor');
    });
  }
  if (useCustomColorToggle) {
    gatePremiumCheckbox('use-custom-color', FEATURES.customColor, 'useCustomColor');
  }
  bindCheckbox('matte-toggle', 'matteFinish');
  gatePremiumCheckbox('two-tone-toggle', FEATURES.twoTone, 'twoTone');

  // Show/hide chain color group when two-tone is toggled
  const chainColorGroup = document.getElementById('chain-color-group');
  const twoToneToggle = document.getElementById('two-tone-toggle');
  if (twoToneToggle && chainColorGroup) {
    const syncChainGroup = () => {
      chainColorGroup.style.display = twoToneToggle.checked ? '' : 'none';
    };
    twoToneToggle.addEventListener('change', syncChainGroup);
    syncChainGroup();
  }

  const bgColorInput = document.getElementById('bg-color');
  if (bgColorInput) {
    bgColorInput.addEventListener('input', () => {
      state.backgroundColor = bgColorInput.value;
      onChange(state, 'backgroundColor');
    });
  }

  // Chain material (two-tone)
  const chainMatBtns = document.querySelectorAll('.chain-color-btn');
  chainMatBtns.forEach(btn => {
    if (PREMIUM_MATERIALS.has(btn.dataset.color)) btn.classList.add('locked');
    btn.addEventListener('click', (event) => {
      if (PREMIUM_MATERIALS.has(btn.dataset.color) && !isPro()) {
        event.preventDefault();
        event.stopPropagation();
        showUpgradeModal(FEATURES.premiumMaterial);
        return;
      }
      chainMatBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.chainMaterial = btn.dataset.color;
      onChange(state, 'chainMaterial');
    });
  });

  // Pendant material presets
  const colorBtns = document.querySelectorAll('.color-btn:not(.chain-color-btn)');
  colorBtns.forEach(btn => {
    if (PREMIUM_MATERIALS.has(btn.dataset.color)) btn.classList.add('locked');
    btn.addEventListener('click', (event) => {
      if (PREMIUM_MATERIALS.has(btn.dataset.color) && !isPro()) {
        event.preventDefault();
        event.stopPropagation();
        showUpgradeModal(FEATURES.premiumMaterial);
        return;
      }
      colorBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.material = btn.dataset.color;
      onChange(state, 'material');
    });
  });

  // File imports (SVG, STL, image silhouette, image relief) — all Pro.
  gatePremiumFileInput('svg-import', FEATURES.customSvg);
  gatePremiumFileInput('stl-import', FEATURES.stlImport);
  gatePremiumFileInput('image-silhouette-import', FEATURES.imageSilhouette);
  gatePremiumFileInput('image-relief-import', FEATURES.imageRelief);

  // Display
  bindCheckbox('show-dimensions-toggle', 'showDimensions');
  bindCheckbox('auto-rotate-toggle', 'autoRotate');

  // Export
  bindSelect('export-format', 'exportFormat');

  // --- All slider/checkbox/select IDs for reset/preset ---
  const allSliders = {
    'text-size': 'textSize',
    'text-curve': 'textCurve',
    'text-offset-x': 'textOffsetX',
    'text-offset-y': 'textOffsetY',
    'letter-spacing': 'letterSpacing',
    'extrude-depth': 'extrudeDepth',
    'second-line-size': 'secondLineSize',
    'second-line-curve': 'secondLineCurve',
    'second-line-offset-x': 'secondLineOffsetX',
    'second-line-offset-y': 'secondLineOffsetY',
    'second-line-letter-spacing': 'secondLineLetterSpacing',
    'second-line-extrude-depth': 'secondLineExtrudeDepth',
    'third-line-size': 'thirdLineSize',
    'third-line-curve': 'thirdLineCurve',
    'third-line-offset-x': 'thirdLineOffsetX',
    'third-line-offset-y': 'thirdLineOffsetY',
    'third-line-letter-spacing': 'thirdLineLetterSpacing',
    'third-line-extrude-depth': 'thirdLineExtrudeDepth',
    'line-spacing': 'lineSpacing',
    'plate-padding': 'platePadding',
    'plate-radius': 'plateRadius',
    'plate-thickness': 'plateThickness',
    'border-width': 'borderWidth',
    'pendant-scale': 'pendantScale',
    'pendant-offset-x': 'pendantOffsetX',
    'pendant-offset-y': 'pendantOffsetY',
    'pendant-offset-z': 'pendantOffsetZ',
    'chain-scale': 'chainScale',
    'image-threshold': 'imageThreshold',
    'relief-height': 'reliefHeight',
    'relief-resolution': 'reliefResolution'
  };

  const allCheckboxes = {
    'bevel-toggle': 'bevelEnabled',
    'second-line-bevel-toggle': 'secondLineBevelEnabled',
    'third-line-bevel-toggle': 'thirdLineBevelEnabled',
    'align-to-plate-toggle': 'alignToPlate',
    'second-line-align-to-plate-toggle': 'secondLineAlignToPlate',
    'third-line-align-to-plate-toggle': 'thirdLineAlignToPlate',
    'engrave-toggle': 'engrave',
    'lock-pendant-size': 'lockPendantSize',
    'matte-toggle': 'matteFinish',
    'two-tone-toggle': 'twoTone',
    'hide-chain-toggle': 'hideChain',
    'show-dimensions-toggle': 'showDimensions',
    'auto-rotate-toggle': 'autoRotate',
    'use-custom-color': 'useCustomColor',
    'relief-invert-toggle': 'reliefInvert'
  };

  const allSelects = {
    'font-select': 'font',
    'second-line-font': 'secondLineFont',
    'third-line-font': 'thirdLineFont',
    'text-alignment': 'textAlignment',
    'shape-select': 'pendantShape',
    'chain-type-select': 'chainType',
    'export-format': 'exportFormat'
  };

  const allTextInputs = {
    'text-input': 'text',
    'second-line-input': 'secondLineText',
    'third-line-input': 'thirdLineText'
  };

  function syncUIFromState() {
    for (const [id, key] of Object.entries(allSliders)) {
      const slider = document.getElementById(id);
      const valEl = document.getElementById(id + '-val');
      if (slider) slider.value = state[key];
      if (valEl) valEl.textContent = state[key];
    }
    for (const [id, key] of Object.entries(allCheckboxes)) {
      const el = document.getElementById(id);
      if (el) el.checked = !!state[key];
    }
    for (const [id, key] of Object.entries(allSelects)) {
      const el = document.getElementById(id);
      if (el) el.value = state[key];
    }
    for (const [id, key] of Object.entries(allTextInputs)) {
      const el = document.getElementById(id);
      if (el) el.value = state[key] || '';
    }
    if (customColorInput) customColorInput.value = state.customColor || DEFAULTS.customColor;
    if (bgColorInput) bgColorInput.value = state.backgroundColor || DEFAULTS.backgroundColor;
    colorBtns.forEach(b => b.classList.toggle('active', b.dataset.color === state.material));
    chainMatBtns.forEach(b => b.classList.toggle('active', b.dataset.color === state.chainMaterial));

    // Sync per-line color toggles
    [['line1-color-toggle', 'line1-color', 'line1-color-row', 'lineColor1'],
     ['line2-color-toggle', 'line2-color', 'line2-color-row', 'lineColor2'],
     ['line3-color-toggle', 'line3-color', 'line3-color-row', 'lineColor3']
    ].forEach(([toggleId, colorId, rowId, key]) => {
      const toggle = document.getElementById(toggleId);
      const colorInput = document.getElementById(colorId);
      const row = document.getElementById(rowId);
      if (toggle) toggle.checked = !!state[key];
      if (colorInput && state[key]) colorInput.value = state[key];
      if (row) row.style.display = state[key] ? '' : 'none';
    });

    // Sync chain color group visibility
    const ccg = document.getElementById('chain-color-group');
    if (ccg) ccg.style.display = state.twoTone ? '' : 'none';
  }

  // Reset
  window.addEventListener('reset-to-defaults', () => {
    Object.assign(state, { ...DEFAULTS });
    syncUIFromState();
    onChange(state, 'reset');
  });

  // Load preset
  window.addEventListener('load-preset', (e) => {
    const preset = e.detail;
    if (!preset) return;
    Object.assign(state, preset);
    syncUIFromState();
    onChange(state, 'reset');
  });

  // Sync UI from external state change (e.g. shared URL) without triggering rebuild
  window.addEventListener('sync-ui-only', (e) => {
    const preset = e.detail;
    if (!preset) return;
    Object.assign(state, preset);
    syncUIFromState();
  });

  // SVG shape loaded
  window.addEventListener('svg-shape-loaded', (e) => {
    state.customShapePoints = e.detail;
    state.pendantShape = 'custom';
    shapeSelect.value = 'custom';
    onChange(state, 'pendantShape');
  });

  // --- Pro status badge ---
  const proStatusBadge = document.getElementById('pro-status');
  function refreshProStatus() {
    if (!proStatusBadge) return;
    if (isPro()) {
      proStatusBadge.textContent = 'PRO';
      proStatusBadge.className = 'pro';
      proStatusBadge.title = 'You are on Chain Studio Pro';
      // Unlock visual state of premium material buttons.
      document.querySelectorAll('.color-btn.locked').forEach(b => b.classList.remove('locked'));
    } else {
      proStatusBadge.textContent = 'FREE';
      proStatusBadge.className = 'free';
      proStatusBadge.title = 'Click to unlock Pro';
      // Re-lock material buttons if user somehow regressed.
      document.querySelectorAll('.color-btn').forEach(b => {
        if (PREMIUM_MATERIALS.has(b.dataset.color)) b.classList.add('locked');
      });
    }
  }
  if (proStatusBadge) {
    proStatusBadge.addEventListener('click', () => {
      if (isPro()) return;
      showUpgradeModal('Chain Studio Pro');
    });
  }
  refreshProStatus();
  window.addEventListener('pro-state-change', refreshProStatus);

  return state;
}
