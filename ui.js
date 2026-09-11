/* ui.js
   Small, generic UI helpers: toasts, modal open/close, confirm dialog.
   Page-specific rendering lives in app.js.
*/

const UI = {
  toastContainer: null,

  init() {
    this.toastContainer = document.getElementById('toast-container');
    // close modal on backdrop click
    document.getElementById('modal-backdrop').addEventListener('click', (e) => {
      if (e.target.id === 'modal-backdrop') this.closeModal();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.closeModal();
    });
  },

  toast(message, type = 'info') {
    if (!this.toastContainer) return;
    const el = document.createElement('div');
    el.className = `toast toast--${type}`;
    el.setAttribute('role', 'status');
    el.textContent = message;
    this.toastContainer.appendChild(el);
    requestAnimationFrame(() => el.classList.add('toast--show'));
    setTimeout(() => {
      el.classList.remove('toast--show');
      setTimeout(() => el.remove(), 250);
    }, 3200);
  },

  openModal(titleHtml, bodyHtml) {
    const backdrop = document.getElementById('modal-backdrop');
    const modal = document.getElementById('modal');
    document.getElementById('modal-title').textContent = titleHtml;
    document.getElementById('modal-body').innerHTML = bodyHtml;
    backdrop.classList.add('is-open');
    modal.classList.add('is-open');
    document.body.classList.add('no-scroll');
    const firstInput = modal.querySelector('input, select, textarea, button');
    if (firstInput) setTimeout(() => firstInput.focus(), 50);
  },

  closeModal() {
    document.getElementById('modal-backdrop').classList.remove('is-open');
    document.getElementById('modal').classList.remove('is-open');
    document.body.classList.remove('no-scroll');
    document.getElementById('modal-body').innerHTML = '';
  },

  confirm(message, onConfirm, opts = {}) {
    const body = `
      <p class="confirm-text">${message}</p>
      <div class="modal-actions">
        <button type="button" class="btn btn--ghost" data-action="cancel">Cancel</button>
        <button type="button" class="btn btn--danger" data-action="confirm">${opts.confirmLabel || 'Delete'}</button>
      </div>
    `;
    this.openModal(opts.title || 'Are you sure?', body);
    const modal = document.getElementById('modal');
    modal.querySelector('[data-action="cancel"]').addEventListener('click', () => this.closeModal());
    modal.querySelector('[data-action="confirm"]').addEventListener('click', () => {
      this.closeModal();
      onConfirm();
    });
  },

  emptyState(message, actionLabel, onAction) {
    const wrap = document.createElement('div');
    wrap.className = 'empty-state';
    wrap.innerHTML = `
      <div class="empty-state__icon">🪙</div>
      <p>${message}</p>
      ${actionLabel ? `<button type="button" class="btn btn--primary" data-empty-action>${actionLabel}</button>` : ''}
    `;
    if (actionLabel && onAction) {
      wrap.querySelector('[data-empty-action]').addEventListener('click', onAction);
    }
    return wrap;
  },

  escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  },
};
