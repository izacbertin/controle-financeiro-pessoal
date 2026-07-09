/*
 * Aviso curto e discreto no canto da tela ("Gasto salvo", "Backup exportado"
 * etc.), some sozinho depois de alguns segundos.
 */
window.App = window.App || {};

App.toast = (function () {
  let timer = null;

  function show(mensagem, tipo) {
    const root = document.getElementById('toast-root');
    if (!root) return;
    root.textContent = '';
    const el = document.createElement('div');
    el.className = `toast toast--${tipo || 'info'}`;
    el.textContent = mensagem;
    root.appendChild(el);

    // Força reflow para a transição de entrada rodar.
    void el.offsetWidth;
    el.classList.add('is-visible');

    clearTimeout(timer);
    timer = setTimeout(() => {
      el.classList.remove('is-visible');
      setTimeout(() => el.remove(), 250);
    }, 2600);
  }

  return { show };
})();
