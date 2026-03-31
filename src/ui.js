import { DEFAULTS } from './constants.js';

export function initUI(onChange) {
  const state = { ...DEFAULTS };

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
  bindSelect('font-select', 'font');
  bindSlider('text-size', 'textSize', parseInt);
  bindSlider('text-curve', 'textCurve', parseFloat);
  bindSlider('text-offset-x', 'textOffsetX', parseFloat);
  bindSlider('text-offset-y', 'textOffsetY', parseFloat);

  // --- Line 2 ---
  bindTextInput('second-line-input', 'secondLineText');
  bindSelect('second-line-font', 'secondLineFont');
  bindSlider('second-line-size', 'secondLineSize', parseInt);
  bindSlider('second-line-curve', 'secondLineCurve', parseFloat);
  bindSlider('second-line-offset-x', 'secondLineOffsetX', parseFloat);
  bindSlider('second-line-offset-y', 'secondLineOffsetY', parseFloat);

  // --- Line 3 ---
  bindTextInput('third-line-input', 'thirdLineText');
  bindSelect('third-line-font', 'thirdLineFont');
  bindSlider('third-line-size', 'thirdLineSize', parseInt);
  bindSlider('third-line-curve', 'thirdLineCurve', parseFloat);
  bindSlider('third-line-offset-x', 'thirdLineOffsetX', parseFloat);
  bindSlider('third-line-offset-y', 'thirdLineOffsetY', parseFloat);

  // --- Shared text ---
  bindSlider('line-spacing', 'lineSpacing', parseFloat);
  bindSlider('letter-spacing', 'letterSpacing', parseFloat);
  bindSelect('text-alignment', 'textAlignment');
  bindSlider('extrude-depth', 'extrudeDepth', parseInt);
  bindCheckbox('bevel-toggle', 'bevelEnabled');
  bindCheckbox('engrave-toggle', 'engrave');

  // --- Plate ---
  bindSlider('plate-padding', 'platePadding', parseInt);
  bindSlider('plate-radius', 'plateRadius', parseInt);
  bindSlider('plate-thickness', 'plateThickness', parseFloat);
  bindSlider('border-width', 'borderWidth', parseFloat);

  // --- Shape ---
  const shapeSelect = document.getElementById('shape-select');
  shapeSelect.addEventListener('change', () => {
    state.pendantShape = shapeSelect.value;
    onChange(state, 'pendantShape');
  });

  // --- Pendant position ---
  bindSlider('pendant-scale', 'pendantScale', parseFloat);
  bindSlider('pendant-offset-x', 'pendantOffsetX', parseFloat);
  bindSlider('pendant-offset-y', 'pendantOffsetY', parseFloat);
  bindSlider('pendant-offset-z', 'pendantOffsetZ', parseFloat);

  // --- Chain ---
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
    useCustomColorToggle.addEventListener('change', () => {
      state.useCustomColor = useCustomColorToggle.checked;
      onChange(state, 'useCustomColor');
    });
  }
  bindCheckbox('matte-toggle', 'matteFinish');
  bindCheckbox('two-tone-toggle', 'twoTone');

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

  // Pendant material presets
  const colorBtns = document.querySelectorAll('.color-btn:not(.chain-color-btn)');
  colorBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      colorBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.material = btn.dataset.color;
      onChange(state, 'material');
    });
  });

  // Display
  bindCheckbox('show-dimensions-toggle', 'showDimensions');

  // Export
  bindSelect('export-format', 'exportFormat');

  // --- All slider/checkbox/select IDs for reset/preset ---
  const allSliders = {
    'text-size': 'textSize',
    'text-curve': 'textCurve',
    'text-offset-x': 'textOffsetX',
    'text-offset-y': 'textOffsetY',
    'second-line-size': 'secondLineSize',
    'second-line-curve': 'secondLineCurve',
    'second-line-offset-x': 'secondLineOffsetX',
    'second-line-offset-y': 'secondLineOffsetY',
    'third-line-size': 'thirdLineSize',
    'third-line-curve': 'thirdLineCurve',
    'third-line-offset-x': 'thirdLineOffsetX',
    'third-line-offset-y': 'thirdLineOffsetY',
    'line-spacing': 'lineSpacing',
    'letter-spacing': 'letterSpacing',
    'extrude-depth': 'extrudeDepth',
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
    'engrave-toggle': 'engrave',
    'matte-toggle': 'matteFinish',
    'two-tone-toggle': 'twoTone',
    'hide-chain-toggle': 'hideChain',
    'show-dimensions-toggle': 'showDimensions',
    'use-custom-color': 'useCustomColor',
    'relief-invert-toggle': 'reliefInvert'
  };

  const allSelects = {
    'font-select': 'font',
    'second-line-font': 'secondLineFont',
    'third-line-font': 'thirdLineFont',
    'text-alignment': 'textAlignment',
    'shape-select': 'pendantShape',
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

  // SVG shape loaded
  window.addEventListener('svg-shape-loaded', (e) => {
    state.customShapePoints = e.detail;
    state.pendantShape = 'custom';
    shapeSelect.value = 'custom';
    onChange(state, 'pendantShape');
  });

  return state;
}
