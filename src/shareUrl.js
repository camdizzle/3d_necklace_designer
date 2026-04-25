import { DEFAULTS } from './constants.js';

const SHARE_KEYS = [
  'text', 'font', 'textSize', 'textCurve', 'textOffsetX', 'textOffsetY',
  'letterSpacing', 'extrudeDepth', 'bevelEnabled', 'alignToPlate',
  'secondLineText', 'secondLineFont', 'secondLineSize', 'secondLineCurve',
  'secondLineOffsetX', 'secondLineOffsetY', 'secondLineLetterSpacing',
  'secondLineExtrudeDepth', 'secondLineBevelEnabled', 'secondLineAlignToPlate',
  'thirdLineText', 'thirdLineFont', 'thirdLineSize', 'thirdLineCurve',
  'thirdLineOffsetX', 'thirdLineOffsetY', 'thirdLineLetterSpacing',
  'thirdLineExtrudeDepth', 'thirdLineBevelEnabled', 'thirdLineAlignToPlate',
  'lineSpacing', 'textAlignment',
  'platePadding', 'plateRadius', 'plateThickness', 'pendantShape',
  'engrave', 'borderWidth',
  'pendantScale', 'pendantOffsetX', 'pendantOffsetY', 'pendantOffsetZ',
  'chainType', 'chainScale',
  'material', 'customColor', 'useCustomColor', 'chainMaterial', 'twoTone', 'matteFinish',
  'lineColor1', 'lineColor2', 'lineColor3',
  'lockPendantSize', 'lockedPlateW', 'lockedPlateH'
];

export function stateToShareUrl(state) {
  const diff = {};
  for (const key of SHARE_KEYS) {
    const val = state[key];
    const def = DEFAULTS[key];
    if (val !== def && val !== null && val !== undefined) {
      diff[key] = val;
    }
  }
  if (Object.keys(diff).length === 0) return window.location.origin + window.location.pathname;
  const json = JSON.stringify(diff);
  const encoded = btoa(unescape(encodeURIComponent(json)));
  return window.location.origin + window.location.pathname + '#design=' + encoded;
}

export function loadStateFromUrl() {
  const hash = window.location.hash;
  if (!hash || !hash.includes('design=')) return null;
  try {
    const encoded = hash.split('design=')[1];
    const json = decodeURIComponent(escape(atob(encoded)));
    const diff = JSON.parse(json);
    const restored = { ...DEFAULTS };
    for (const key of SHARE_KEYS) {
      if (key in diff) restored[key] = diff[key];
    }
    return restored;
  } catch (e) {
    console.warn('Failed to parse shared design URL:', e);
    return null;
  }
}

export function clearShareHash() {
  if (window.location.hash.includes('design=')) {
    history.replaceState(null, '', window.location.pathname + window.location.search);
  }
}
