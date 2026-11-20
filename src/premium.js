// Export payment for Chain Studio.
//
// All features are unlocked for every user. Designing, sharing, and
// screenshots are free. Exporting a model (STL/OBJ/GLB) costs $2
// per download, handled via Stripe Checkout.

const EXPORT_PRICE_DISPLAY = '$2';

let _exportModal = null;

function buildExportModal() {
  if (_exportModal) return;

  const modal = document.createElement('div');
  modal.id = 'export-modal';
  modal.className = 'export-modal hidden';
  modal.innerHTML = `
    <div class="export-modal-backdrop"></div>
    <div class="export-modal-card" role="dialog" aria-labelledby="export-modal-title">
      <button class="export-modal-close" aria-label="Close">&times;</button>
      <h2 id="export-modal-title">Export Your Design</h2>
      <p class="export-modal-desc" id="export-modal-desc">
        Download your 3D model ready for printing.
      </p>
      <div id="export-modal-warnings"></div>
      <div class="export-modal-price">${EXPORT_PRICE_DISPLAY} <span>per export</span></div>
      <button class="export-modal-buy" id="export-modal-buy">
        Pay &amp; Download
      </button>
      <p class="export-modal-note">Secure checkout via Stripe</p>
    </div>
  `;

  document.body.appendChild(modal);
  _exportModal = modal;

  const close = () => modal.classList.add('hidden');
  modal.querySelector('.export-modal-backdrop').addEventListener('click', close);
  modal.querySelector('.export-modal-close').addEventListener('click', close);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !modal.classList.contains('hidden')) close();
  });
}

let _onConfirmExport = null;

export function showExportModal(onConfirm, { format = 'stl', warningsHtml = '' } = {}) {
  buildExportModal();
  _onConfirmExport = onConfirm;
  const modal = document.getElementById('export-modal');
  if (!modal) return;
  const desc = document.getElementById('export-modal-desc');
  if (desc) {
    desc.textContent = format === '3mf'
      ? 'Download your design as a 3MF file. Each colour is a separate part, ready for multi-colour printing.'
      : 'Download your design as an STL file, ready for slicing and printing.';
  }
  const warn = document.getElementById('export-modal-warnings');
  if (warn) warn.innerHTML = warningsHtml;
  const buyBtn = document.getElementById('export-modal-buy');
  if (buyBtn) {
    buyBtn.disabled = false;
    buyBtn.textContent = 'Pay & Download';
  }
  modal.classList.remove('hidden');
}

export function initPremium() {
  buildExportModal();

  const buyBtn = document.getElementById('export-modal-buy');
  if (buyBtn) {
    buyBtn.addEventListener('click', async () => {
      if (_onConfirmExport) {
        buyBtn.disabled = true;
        buyBtn.textContent = 'PROCESSING...';
        await _onConfirmExport();
      }
    });
  }
}
