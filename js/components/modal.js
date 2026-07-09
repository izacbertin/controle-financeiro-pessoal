/*
 * Modal genérico reutilizável. As telas de CRUD só passam o HTML de dentro
 * (título + corpo) — abrir/fechar, overlay, ESC e foco ficam centralizados
 * aqui para não repetir esse comportamento em cada formulário.
 */
window.App = window.App || {};

App.modal = (function () {
  let root = null;
  let onCloseCallback = null;

  function ensureRoot() {
    if (!root) root = document.getElementById('modal-root');
    return root;
  }

  function open({ title, bodyHtml, onMount, onClose, size }) {
    const el = ensureRoot();
    onCloseCallback = onClose || null;
    el.innerHTML = `
      <div class="modal-overlay">
        <div class="modal-dialog ${size === 'lg' ? 'modal-dialog--lg' : ''}" role="dialog" aria-modal="true" aria-label="${App.utils.escapeHtml(title)}">
          <div class="modal-header">
            <h2>${App.utils.escapeHtml(title)}</h2>
            <button type="button" class="icon-button" data-action="closeModal" aria-label="Fechar">✕</button>
          </div>
          <div class="modal-body">${bodyHtml}</div>
        </div>
      </div>`;
    el.classList.add('is-open');
    document.body.classList.add('no-scroll');

    const overlay = el.querySelector('.modal-overlay');
    overlay.addEventListener('mousedown', (e) => {
      if (e.target === overlay) close();
    });

    // Delegado: pega o botão "✕" do cabeçalho e qualquer "Cancelar" que os
    // formulários das telas coloquem no rodapé com data-action="closeModal".
    el.addEventListener('click', (e) => {
      if (e.target.closest('[data-action="closeModal"]')) close();
    });

    document.addEventListener('keydown', handleEsc);

    if (typeof onMount === 'function') onMount(el.querySelector('.modal-dialog'));

    const firstInput = el.querySelector('input, select, textarea, button:not([data-action="closeModal"])');
    if (firstInput) firstInput.focus();
  }

  function handleEsc(e) {
    if (e.key === 'Escape') close();
  }

  function close() {
    const el = ensureRoot();
    el.classList.remove('is-open');
    el.innerHTML = '';
    document.body.classList.remove('no-scroll');
    document.removeEventListener('keydown', handleEsc);
    if (onCloseCallback) onCloseCallback();
    onCloseCallback = null;
  }

  return { open, close };
})();
