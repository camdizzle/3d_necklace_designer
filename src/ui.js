import { DEFAULTS } from './constants.js';

export function initUI(onChange) {
  const state = { ...DEFAULTS };

  // Text input
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

  // Slider helper
  function bindSlider(id, key, transform = parseFloat) {
    const slider = document.getElementById(id);
    const valEl = document.getElementById(id + '-val');
    slider.addEventListener('input', () => {
      const val = transform(slider.value);
      state[key] = val;
      valEl.textContent = val;
      onChange(state, key);
    });
  }

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

  // Bevel toggle
  const bevelToggle = document.getElementById('bevel-toggle');
  bevelToggle.addEventListener('change', () => {
    state.bevelEnabled = bevelToggle.checked;
    onChange(state, 'bevel');
  });

  // Color presets
  const colorBtns = document.querySelectorAll('.color-btn');
  colorBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      colorBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.material = btn.dataset.color;
      onChange(state, 'material');
    });
  });

  return state;
}
