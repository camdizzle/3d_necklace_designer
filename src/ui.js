import { DEFAULTS } from './constants.js';

export function initUI(onChange) {
  const state = { ...DEFAULTS };

  // --- Text input ---
  const textInput = document.getElementById('text-input');
  let textDebounce;
  textInput.addEventListener('input', () => {
    clearTimeout(textDebounce);
    textDebounce = setTimeout(() => {
      state.text = textInput.value;
      onChange(state, 'text');
    }, 300);
  });

  // Font select
  const fontSelect = document.getElementById('font-select');
  fontSelect.addEventListener('change', () => {
    state.font = fontSelect.value;
    onChange(state, 'font');
  });

  // Shape select
  const shapeSelect = document.getElementById('shape-select');
  shapeSelect.addEventListener('change', () => {
    state.pendantShape = shapeSelect.value;
    onChange(state, 'pendantShape');
  });

  // --- Slider helper ---
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

  // --- Checkbox helper ---
  function bindCheckbox(id, key) {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('change', () => {
      state[key] = el.checked;
      onChange(state, key);
    });
  }

  // --- Text debounce input helper ---
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

  // --- Select helper ---
  function bindSelect(id, key) {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('change', () => {
      state[key] = el.value;
      onChange(state, key);
    });
  }

  // Pendant size sliders
  bindSlider('text-size', 'textSize', parseInt);
  bindSlider('extrude-depth', 'extrudeDepth', parseInt);
  bindSlider('plate-padding', 'platePadding', parseInt);
  bindSlider('plate-radius', 'plateRadius', parseInt);
  bindSlider('plate-thickness', 'plateThickness', parseFloat);
  bindSlider('pendant-scale', 'pendantScale', parseFloat);
  bindSlider('pendant-offset-x', 'pendantOffsetX', parseFloat);
  bindSlider('pendant-offset-y', 'pendantOffsetY', parseFloat);
  bindSlider('pendant-offset-z', 'pendantOffsetZ', parseFloat);
  bindSlider('chain-scale', 'chainScale', parseFloat);

  // Text features
  bindSlider('letter-spacing', 'letterSpacing', parseFloat);
  bindSlider('text-curve', 'textCurve', parseFloat);
  bindSlider('second-line-size', 'secondLineSize', parseInt);
  bindSelect('text-alignment', 'textAlignment');
  bindTextInput('second-line-input', 'secondLineText');

  // Plate features
  bindSlider('border-width', 'borderWidth', parseFloat);
  bindCheckbox('engrave-toggle', 'engrave');

  // Bevel toggle
  bindCheckbox('bevel-toggle', 'bevelEnabled');

  // Visual features
  bindCheckbox('matte-toggle', 'matteFinish');
  bindCheckbox('two-tone-toggle', 'twoTone');
  bindCheckbox('hide-chain-toggle', 'hideChain');
  bindCheckbox('show-dimensions-toggle', 'showDimensions');

  // Custom color
  const customColorInput = document.getElementById('custom-color');
  const useCustomColorToggle = document.getElementById('use-custom-color');
  if (customColorInput) {
    customColorInput.addEventListener('input', () => {
      state.customColor = customColorInput.value;
      if (state.useCustomColor) {
        onChange(state, 'customColor');
      }
    });
  }
  if (useCustomColorToggle) {
    useCustomColorToggle.addEventListener('change', () => {
      state.useCustomColor = useCustomColorToggle.checked;
      onChange(state, 'useCustomColor');
    });
  }

  // Background color
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
    btn.addEventListener('click', () => {
      chainMatBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.chainMaterial = btn.dataset.color;
      onChange(state, 'chainMaterial');
    });
  });

  // Export format
  bindSelect('export-format', 'exportFormat');

  // Color presets (pendant material)
  const colorBtns = document.querySelectorAll('.color-btn:not(.chain-color-btn)');
  colorBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      colorBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.material = btn.dataset.color;
      onChange(state, 'material');
    });
  });

  // --- Reset to defaults ---
  function resetAll() {
    Object.assign(state, { ...DEFAULTS });

    // Update all UI elements to match defaults
    textInput.value = DEFAULTS.text;
    fontSelect.value = DEFAULTS.font;
    shapeSelect.value = DEFAULTS.pendantShape;

    // Update sliders
    const sliders = {
      'text-size': DEFAULTS.textSize,
      'extrude-depth': DEFAULTS.extrudeDepth,
      'plate-padding': DEFAULTS.platePadding,
      'plate-radius': DEFAULTS.plateRadius,
      'plate-thickness': DEFAULTS.plateThickness,
      'pendant-scale': DEFAULTS.pendantScale,
      'pendant-offset-x': DEFAULTS.pendantOffsetX,
      'pendant-offset-y': DEFAULTS.pendantOffsetY,
      'pendant-offset-z': DEFAULTS.pendantOffsetZ,
      'chain-scale': DEFAULTS.chainScale,
      'letter-spacing': DEFAULTS.letterSpacing,
      'text-curve': DEFAULTS.textCurve,
      'second-line-size': DEFAULTS.secondLineSize,
      'border-width': DEFAULTS.borderWidth
    };
    for (const [id, val] of Object.entries(sliders)) {
      const slider = document.getElementById(id);
      const valEl = document.getElementById(id + '-val');
      if (slider) slider.value = val;
      if (valEl) valEl.textContent = val;
    }

    // Update checkboxes
    const checkboxes = {
      'bevel-toggle': DEFAULTS.bevelEnabled,
      'engrave-toggle': DEFAULTS.engrave,
      'matte-toggle': DEFAULTS.matteFinish,
      'two-tone-toggle': DEFAULTS.twoTone,
      'hide-chain-toggle': DEFAULTS.hideChain,
      'show-dimensions-toggle': DEFAULTS.showDimensions,
      'use-custom-color': DEFAULTS.useCustomColor
    };
    for (const [id, val] of Object.entries(checkboxes)) {
      const el = document.getElementById(id);
      if (el) el.checked = val;
    }

    // Update selects
    const selects = {
      'text-alignment': DEFAULTS.textAlignment,
      'export-format': DEFAULTS.exportFormat
    };
    for (const [id, val] of Object.entries(selects)) {
      const el = document.getElementById(id);
      if (el) el.value = val;
    }

    // Text inputs
    const secondLineInput = document.getElementById('second-line-input');
    if (secondLineInput) secondLineInput.value = DEFAULTS.secondLineText;

    if (customColorInput) customColorInput.value = DEFAULTS.customColor;
    if (bgColorInput) bgColorInput.value = DEFAULTS.backgroundColor;

    // Reset color preset buttons
    colorBtns.forEach(b => {
      b.classList.toggle('active', b.dataset.color === DEFAULTS.material);
    });
    chainMatBtns.forEach(b => {
      b.classList.toggle('active', b.dataset.color === DEFAULTS.chainMaterial);
    });

    onChange(state, 'reset');
  }

  window.addEventListener('reset-to-defaults', resetAll);

  // --- Load preset ---
  window.addEventListener('load-preset', (e) => {
    const preset = e.detail;
    if (!preset) return;
    Object.assign(state, preset);
    // Re-sync UI (same as reset but with preset values)
    textInput.value = state.text;
    fontSelect.value = state.font;
    shapeSelect.value = state.pendantShape;

    const sliders = {
      'text-size': state.textSize,
      'extrude-depth': state.extrudeDepth,
      'plate-padding': state.platePadding,
      'plate-radius': state.plateRadius,
      'plate-thickness': state.plateThickness,
      'pendant-scale': state.pendantScale,
      'pendant-offset-x': state.pendantOffsetX,
      'pendant-offset-y': state.pendantOffsetY,
      'pendant-offset-z': state.pendantOffsetZ,
      'chain-scale': state.chainScale,
      'letter-spacing': state.letterSpacing,
      'text-curve': state.textCurve,
      'second-line-size': state.secondLineSize,
      'border-width': state.borderWidth
    };
    for (const [id, val] of Object.entries(sliders)) {
      const slider = document.getElementById(id);
      const valEl = document.getElementById(id + '-val');
      if (slider) slider.value = val;
      if (valEl) valEl.textContent = val;
    }

    const checkboxes = {
      'bevel-toggle': state.bevelEnabled,
      'engrave-toggle': state.engrave,
      'matte-toggle': state.matteFinish,
      'two-tone-toggle': state.twoTone,
      'hide-chain-toggle': state.hideChain,
      'show-dimensions-toggle': state.showDimensions,
      'use-custom-color': state.useCustomColor
    };
    for (const [id, val] of Object.entries(checkboxes)) {
      const el = document.getElementById(id);
      if (el) el.checked = !!val;
    }

    const selects = {
      'text-alignment': state.textAlignment,
      'export-format': state.exportFormat
    };
    for (const [id, val] of Object.entries(selects)) {
      const el = document.getElementById(id);
      if (el) el.value = val || DEFAULTS[Object.keys(DEFAULTS).find(k => k === id.replace(/-([a-z])/g, (_, c) => c.toUpperCase()))];
    }

    const secondLineInput = document.getElementById('second-line-input');
    if (secondLineInput) secondLineInput.value = state.secondLineText || '';
    if (customColorInput) customColorInput.value = state.customColor || DEFAULTS.customColor;
    if (bgColorInput) bgColorInput.value = state.backgroundColor || DEFAULTS.backgroundColor;

    colorBtns.forEach(b => {
      b.classList.toggle('active', b.dataset.color === state.material);
    });
    chainMatBtns.forEach(b => {
      b.classList.toggle('active', b.dataset.color === state.chainMaterial);
    });

    onChange(state, 'reset');
  });

  // --- SVG shape loaded ---
  window.addEventListener('svg-shape-loaded', (e) => {
    state.customShapePoints = e.detail;
    state.pendantShape = 'custom';
    shapeSelect.value = 'custom';
    onChange(state, 'pendantShape');
  });

  return state;
}
