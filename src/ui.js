import { DEFAULTS, OUTLINE_FONTS, FONT_LABELS } from './constants.js';

export function initUI(onChange) {
  const state = { ...DEFAULTS };

  // --- Collapsible sections ---
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
  bindSelect('font-select', 'font');
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
  bindSelect('second-line-font', 'secondLineFont');
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
  bindSelect('third-line-font', 'thirdLineFont');
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
  bindCheckbox('engrave-toggle', 'engrave');

  // --- Plate ---
  bindCheckbox('lock-pendant-size', 'lockPendantSize');
  bindSlider('plate-padding', 'platePadding', parseInt);
  bindSlider('plate-radius', 'plateRadius', parseInt);
  bindSlider('plate-thickness', 'plateThickness', parseFloat);
  bindSlider('outline-base-depth', 'outlineBaseDepth', parseFloat);
  bindSlider('outline-raised-depth', 'outlineRaisedDepth', parseFloat);
  bindSlider('outline-scale', 'outlineWidth', parseFloat);

  const outlineBottomColorInput = document.getElementById('outline-bottom-color');
  if (outlineBottomColorInput) {
    outlineBottomColorInput.addEventListener('input', () => {
      state.outlineBottomColor = outlineBottomColorInput.value;
      onChange(state, 'outlineBottomColor');
    });
  }
  bindSlider('border-width', 'borderWidth', parseFloat);

  // --- Shape ---
  const shapeSelect = document.getElementById('shape-select');
  bindSelect('shape-select', 'pendantShape');
  if (shapeSelect) {
    shapeSelect.addEventListener('change', () => {
      updateFontSelectsForShape(shapeSelect.value);
    });
  }

  const fontSelectIds = ['font-select', 'second-line-font', 'third-line-font'];
  const fontStateKeys = ['font', 'secondLineFont', 'thirdLineFont'];
  const savedNormalOptions = {};

  fontSelectIds.forEach(id => {
    const el = document.getElementById(id);
    if (el) savedNormalOptions[id] = el.innerHTML;
  });

  function updateFontSelectsForShape(shape) {
    const isOutline = shape === 'outline';
    fontSelectIds.forEach((id, i) => {
      const el = document.getElementById(id);
      if (!el) return;
      if (isOutline) {
        el.innerHTML = OUTLINE_FONTS.map(key =>
          `<option value="${key}">${FONT_LABELS[key] || key}</option>`
        ).join('');
        if (!OUTLINE_FONTS.includes(state[fontStateKeys[i]])) {
          state[fontStateKeys[i]] = OUTLINE_FONTS[0];
        }
        el.value = state[fontStateKeys[i]];
      } else {
        el.innerHTML = savedNormalOptions[id];
        if (OUTLINE_FONTS.includes(state[fontStateKeys[i]])) {
          state[fontStateKeys[i]] = 'helvetiker_bold';
        }
        el.value = state[fontStateKeys[i]];
      }
    });
  }

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
    bindCheckbox('use-custom-color', 'useCustomColor');
  }
  bindCheckbox('matte-toggle', 'matteFinish');
  bindCheckbox('two-tone-toggle', 'twoTone');

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
    'outline-base-depth': 'outlineBaseDepth',
    'outline-raised-depth': 'outlineRaisedDepth',
    'outline-scale': 'outlineWidth',
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

    updateFontSelectsForShape(state.pendantShape);

    const obc = document.getElementById('outline-bottom-color');
    if (obc) obc.value = state.outlineBottomColor || '#000000';

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

  syncUIFromState();

  return state;
}
