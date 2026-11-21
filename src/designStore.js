// Designs kept in this browser: the order ("cart") and "My designs".
// Both live in localStorage, so they survive a reload and the trip to
// Stripe and back. Nothing here is sent anywhere until checkout.

const CART_KEY = 'cs_cart';
const SAVED_KEY = 'cs_my_designs';
const OLD_PRESETS_KEY = 'necklace_presets';
export const MAX_CART_DESIGNS = 20;
const MAX_SAVED = 60;

// Settings that change how the screen looks but not the chain itself.
const NOT_DESIGN = new Set([
  'backgroundColor', 'showDimensions', 'autoRotate', 'exportFormat',
  'imageThreshold', 'reliefResolution', 'reliefData', 'customSTLGeometry'
]);

// A plain copy of the design that can be stored (drops the uploaded
// image relief and imported STL, which can't be saved as text).
export function snapshot(state) {
  const snap = { ...state };
  delete snap.reliefData;
  delete snap.customSTLGeometry;
  return snap;
}

// True if the design uses something a snapshot can't carry.
export function hasUnsavableParts(state) {
  return !!(state.reliefData || state.customSTLGeometry);
}

export function designKey(state) {
  const keys = Object.keys(state).filter((k) => !NOT_DESIGN.has(k)).sort();
  const plain = keys
    .filter((k) => state.lockPendantSize || (k !== 'lockedPlateW' && k !== 'lockedPlateH'))
    .map((k) => [k, state[k]]);
  const text = JSON.stringify(plain);
  let h = 5381;
  for (let i = 0; i < text.length; i++) h = ((h * 33) ^ text.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

export function designTitle(state) {
  return [state.text, state.secondLineText, state.thirdLineText]
    .map((t) => String(t || '').trim()).filter(Boolean).join(' / ') || 'Custom Chain';
}

function read(key, fallback) {
  try {
    const v = JSON.parse(localStorage.getItem(key) || 'null');
    return v ?? fallback;
  } catch {
    return fallback;
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

// ---- cart ----
export function loadCart() {
  const items = read(CART_KEY, []);
  return Array.isArray(items) ? items.filter((it) => it && it.state) : [];
}

export function saveCart(items) {
  return write(CART_KEY, items.slice(0, MAX_CART_DESIGNS));
}

export function clearCart() {
  try { localStorage.removeItem(CART_KEY); } catch {}
}

// ---- my designs ----
export function loadSaved() {
  const list = read(SAVED_KEY, []);
  const saved = Array.isArray(list) ? list.filter((d) => d && d.state) : [];
  // Presets saved before "My designs" existed (no picture).
  const old = read(OLD_PRESETS_KEY, {});
  if (old && typeof old === 'object') {
    for (const [name, state] of Object.entries(old)) {
      if (state && !saved.some((d) => d.id === `preset:${name}`)) {
        saved.push({ id: `preset:${name}`, name, state, thumb: '', savedAt: '' });
      }
    }
  }
  return saved;
}

export function addSaved(entry) {
  const list = read(SAVED_KEY, []).filter((d) => d && d.id !== entry.id);
  list.unshift(entry);
  return write(SAVED_KEY, list.slice(0, MAX_SAVED));
}

export function removeSaved(id) {
  if (id.startsWith('preset:')) {
    const old = read(OLD_PRESETS_KEY, {});
    delete old[id.slice(7)];
    write(OLD_PRESETS_KEY, old);
    return;
  }
  write(SAVED_KEY, read(SAVED_KEY, []).filter((d) => d && d.id !== id));
}

// Where this visitor first came from (?utm_source=…), kept 30 days.
const SOURCE_KEY = 'cs_source';
export function rememberSource() {
  try {
    const src = new URLSearchParams(location.search).get('utm_source');
    const cur = read(SOURCE_KEY, null);
    if (src && /^[a-z0-9_-]{1,20}$/i.test(src) && !(cur && Date.now() - cur.at < 2592e6)) {
      write(SOURCE_KEY, { src: src.toLowerCase(), at: Date.now() });
    }
  } catch {}
}

export function currentSource() {
  const cur = read(SOURCE_KEY, null);
  return cur && Date.now() - cur.at < 2592e6 ? cur.src : '';
}
