let modalContainer = null;

function ensureContainer() {
  if (modalContainer) return modalContainer;
  modalContainer = document.createElement('div');
  modalContainer.id = 'custom-modal-root';
  document.body.appendChild(modalContainer);
  return modalContainer;
}

function createModal(content, { showCancel = false, showInput = false, inputDefault = '', inputPlaceholder = '' } = {}) {
  return new Promise((resolve) => {
    const container = ensureContainer();

    const overlay = document.createElement('div');
    overlay.className = 'cs-modal';

    const card = document.createElement('div');
    card.className = 'cs-modal-card';

    const body = document.createElement('div');
    body.className = 'cs-modal-body';
    body.innerHTML = content;
    card.appendChild(body);

    let inputEl = null;
    if (showInput) {
      inputEl = document.createElement('input');
      inputEl.type = 'text';
      inputEl.className = 'cs-modal-input';
      inputEl.value = inputDefault;
      inputEl.placeholder = inputPlaceholder;
      card.appendChild(inputEl);
    }

    const btnRow = document.createElement('div');
    btnRow.className = 'cs-modal-btns';

    if (showCancel) {
      const cancelBtn = document.createElement('button');
      cancelBtn.className = 'cs-modal-btn cs-modal-btn-cancel';
      cancelBtn.textContent = 'Cancel';
      cancelBtn.addEventListener('click', () => { close(showInput ? null : false); });
      btnRow.appendChild(cancelBtn);
    }

    const okBtn = document.createElement('button');
    okBtn.className = 'cs-modal-btn cs-modal-btn-ok';
    okBtn.textContent = 'OK';
    okBtn.addEventListener('click', () => {
      close(showInput ? inputEl.value : true);
    });
    btnRow.appendChild(okBtn);

    card.appendChild(btnRow);
    overlay.appendChild(card);
    container.appendChild(overlay);

    if (inputEl) {
      requestAnimationFrame(() => { inputEl.focus(); inputEl.select(); });
      inputEl.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') close(inputEl.value);
        if (e.key === 'Escape') close(null);
      });
    } else {
      requestAnimationFrame(() => okBtn.focus());
    }

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) close(showInput ? null : (showCancel ? false : true));
    });

    function close(value) {
      overlay.remove();
      resolve(value);
    }
  });
}

export function csAlert(message) {
  return createModal(message);
}

export function csConfirm(message) {
  return createModal(message, { showCancel: true });
}

export function csPrompt(message, defaultValue = '') {
  return createModal(message, { showCancel: true, showInput: true, inputDefault: defaultValue });
}
