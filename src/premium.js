// Premium / Pro feature gating for Chain Studio.
//
// This module owns everything about "is the user paid, and what are they
// allowed to use?" It does NOT talk to any payment provider directly —
// `verifyLicense()` is a stub so we can plug in Gumroad (or Stripe) later
// without touching the gating logic in the rest of the app.
//
// Gating strategy:
//   1. On boot, `initPremium()` builds the upgrade modal and reads the
//      stored unlock state from localStorage.
//   2. Everywhere a premium feature could be triggered, the caller asks
//      `isPro()` and, if false, calls `showUpgradeModal(featureLabel)`.
//   3. Pro state changes fire `pro-state-change` on window so the UI can
//      re-render lock badges and re-enable controls.
//
// Client-side gating is bypassable by design. That's fine for a v1 —
// the goal is a gentle paywall, not DRM. When revenue justifies it,
// replace `verifyLicense()` with a real backend call that validates the
// license with Gumroad's API server-side.

const STORAGE_KEY = 'necklace_pro_license';
const LICENSE_FORMAT = /^[A-Z0-9]{8}-[A-Z0-9]{8}-[A-Z0-9]{8}-[A-Z0-9]{8}$/;

// TODO: replace with your Gumroad product URL once created.
export const GUMROAD_CHECKOUT_URL = 'https://gumroad.com/l/chain-studio-pro';

// Canonical lists of premium content. Keep in sync with the UI/gen code.
export const PREMIUM_FONTS = new Set([
  'dancing_script',
  'pacifico',
  'great_vibes',
  'allura',
  'sacramento',
  'tangerine',
  'alex_brush',
  'kaushan_script'
]);

export const PREMIUM_SHAPES = new Set([
  'diamond',
  'shield',
  'heart',
  'star',
  'custom'
]);

export const PREMIUM_MATERIALS = new Set([
  'rose',
  'platinum'
]);

// Feature keys used as labels in the upgrade modal. Callers pass these
// to `showUpgradeModal()` so the modal can say "Photo-to-3D Relief is a
// Pro feature" instead of a generic message.
export const FEATURES = {
  export: 'Model Export (STL / OBJ / GLB)',
  scriptFont: 'Script Fonts',
  premiumShape: 'Premium Shapes',
  customSvg: 'Custom SVG Shapes',
  stlImport: 'STL Pendant Import',
  imageSilhouette: 'Image Silhouette Shape',
  imageRelief: 'Photo-to-3D Relief',
  premiumMaterial: 'Rose Gold & Platinum',
  customColor: 'Custom Color Picker',
  twoTone: 'Two-Tone Finish',
  border: 'Decorative Border',
  engrave: 'Engrave Mode',
  cleanScreenshot: 'Watermark-Free Screenshot'
};

let _isPro = false;

// ---------------------------------------------------------------
// Core state
// ---------------------------------------------------------------

export function isPro() {
  return _isPro;
}

/**
 * Verify a license key. This is the seam where real server-side
 * verification plugs in later.
 *
 * For v1 we accept any key that matches the Gumroad license key format
 * (8-8-8-8 alphanumeric). Client-side gating is bypassable anyway; the
 * format check just keeps casual users from typing "pro" to unlock.
 *
 * TODO: replace with a real backend call:
 *   const res = await fetch('/api/verify-license', {
 *     method: 'POST',
 *     headers: { 'Content-Type': 'application/json' },
 *     body: JSON.stringify({ license })
 *   });
 *   const { valid } = await res.json();
 *   return valid;
 */
export async function verifyLicense(license) {
  if (!license) return false;
  return LICENSE_FORMAT.test(license.trim().toUpperCase());
}

export async function unlockPro(license) {
  const valid = await verifyLicense(license);
  if (!valid) return false;
  try {
    localStorage.setItem(STORAGE_KEY, license.trim().toUpperCase());
  } catch {}
  _isPro = true;
  window.dispatchEvent(new CustomEvent('pro-state-change', { detail: { isPro: true } }));
  return true;
}

export function lockPro() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {}
  _isPro = false;
  window.dispatchEvent(new CustomEvent('pro-state-change', { detail: { isPro: false } }));
}

// ---------------------------------------------------------------
// Upgrade modal
// ---------------------------------------------------------------

const MODAL_ID = 'premium-modal';

function buildModal() {
  if (document.getElementById(MODAL_ID)) return;

  const modal = document.createElement('div');
  modal.id = MODAL_ID;
  modal.className = 'premium-modal hidden';
  modal.innerHTML = `
    <div class="premium-modal-backdrop"></div>
    <div class="premium-modal-card" role="dialog" aria-labelledby="premium-modal-title">
      <button class="premium-modal-close" aria-label="Close">×</button>
      <div class="premium-modal-lock">🔒</div>
      <h2 id="premium-modal-title">Unlock Chain Studio Pro</h2>
      <p class="premium-modal-feature">
        <strong id="premium-modal-feature-name">This feature</strong> is a Pro feature.
      </p>

      <ul class="premium-modal-benefits">
        <li>Export STL, OBJ &amp; GLB (ready for 3D print)</li>
        <li>8 premium script fonts</li>
        <li>Heart, Star, Shield, Diamond &amp; custom SVG shapes</li>
        <li>Upload photos &rarr; 3D relief pendants</li>
        <li>Rose gold, platinum &amp; custom colors</li>
        <li>Two-tone chain, decorative border, engrave mode</li>
        <li>Watermark-free screenshots</li>
      </ul>

      <div class="premium-modal-price">$19 <span>one-time</span></div>

      <button class="premium-modal-buy" id="premium-modal-buy">
        Unlock Pro
      </button>

      <div class="premium-modal-divider"><span>already purchased?</span></div>

      <div class="premium-modal-license-row">
        <input
          type="text"
          id="premium-modal-license"
          placeholder="XXXXXXXX-XXXXXXXX-XXXXXXXX-XXXXXXXX"
          autocomplete="off"
          spellcheck="false"
        />
        <button id="premium-modal-redeem">Redeem</button>
      </div>
      <div class="premium-modal-error" id="premium-modal-error"></div>
    </div>
  `;

  document.body.appendChild(modal);

  const close = () => modal.classList.add('hidden');
  modal.querySelector('.premium-modal-backdrop').addEventListener('click', close);
  modal.querySelector('.premium-modal-close').addEventListener('click', close);

  modal.querySelector('#premium-modal-buy').addEventListener('click', () => {
    window.open(GUMROAD_CHECKOUT_URL, '_blank', 'noopener');
  });

  const licenseInput = modal.querySelector('#premium-modal-license');
  const errorEl = modal.querySelector('#premium-modal-error');
  const redeem = async () => {
    errorEl.textContent = '';
    const ok = await unlockPro(licenseInput.value);
    if (ok) {
      errorEl.textContent = '';
      close();
      // Small celebratory toast would be nice, but keep it minimal.
      setTimeout(() => alert('Pro unlocked! All features are now available.'), 100);
    } else {
      errorEl.textContent = 'Invalid license key. Keys look like XXXXXXXX-XXXXXXXX-XXXXXXXX-XXXXXXXX.';
    }
  };
  modal.querySelector('#premium-modal-redeem').addEventListener('click', redeem);
  licenseInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') redeem();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !modal.classList.contains('hidden')) close();
  });
}

export function showUpgradeModal(featureLabel = 'This feature') {
  buildModal();
  const modal = document.getElementById(MODAL_ID);
  if (!modal) return;
  const nameEl = document.getElementById('premium-modal-feature-name');
  if (nameEl) nameEl.textContent = featureLabel;
  const errorEl = document.getElementById('premium-modal-error');
  if (errorEl) errorEl.textContent = '';
  modal.classList.remove('hidden');
}

// ---------------------------------------------------------------
// Boot
// ---------------------------------------------------------------

/**
 * Initialize premium subsystem. Call once at app start, before UI init.
 *
 * - Restores pro state from localStorage.
 * - Supports `?unlock=<key>` URL param for redeem-by-link (e.g. the
 *   Gumroad thank-you page redirects here with the key in the URL).
 * - Exposes dev helpers on window for manual testing.
 */
export async function initPremium() {
  // Restore previous unlock, if any.
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && await verifyLicense(stored)) {
      _isPro = true;
    }
  } catch {}

  // Support unlock via URL param (Gumroad can redirect with license in URL).
  const url = new URL(window.location.href);
  const urlKey = url.searchParams.get('unlock');
  if (urlKey) {
    const ok = await unlockPro(urlKey);
    if (ok) {
      // Clean the URL so the key isn't visible on refresh.
      url.searchParams.delete('unlock');
      window.history.replaceState({}, '', url.toString());
    }
  }

  buildModal();

  // Dev helpers — handy while testing locally, harmless in prod.
  window.__chainStudio = {
    isPro,
    unlockPro,
    lockPro,
    showUpgradeModal
  };

  // Notify listeners (e.g. ui.js refreshProStatus) now that restore is done.
  // This is fired unconditionally so the UI can paint the correct badge
  // whether we restored a pro license or not.
  window.dispatchEvent(new CustomEvent('pro-state-change', { detail: { isPro: _isPro } }));
}
