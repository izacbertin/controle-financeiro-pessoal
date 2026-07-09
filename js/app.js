/*
 * Ponto de entrada: monta a navegação (sidebar no desktop, barra inferior no
 * mobile), decide qual tela desenhar, aplica o tema e liga as ações globais
 * (tema, exportar/importar/zerar backup). Carregado por último no index.html,
 * depois de todos os módulos (App.state, App.views.*, etc.) já existirem.
 */
(function () {
  const utils = App.utils;
  const state = App.state;

  const NAV_ITEMS = [
    { view: 'dashboard', label: 'Painel', icon: '⌂' },
    { view: 'gastos', label: 'Gastos', icon: '▤' },
    { view: 'receitas', label: 'Receitas', icon: '↑' },
    { view: 'notasFiscais', label: 'Notas fiscais', icon: '▦' },
    { view: 'consolidado', label: 'Consolidado', icon: 'Σ' },
  ];

  const TEMA_CICLO = { sistema: 'claro', claro: 'escuro', escuro: 'sistema' };
  const TEMA_ICONE = { sistema: '◐', claro: '☀', escuro: '☾' };
  const TEMA_LABEL = { sistema: 'Automático', claro: 'Claro', escuro: 'Escuro' };

  function navHtml(activeView, extraClass) {
    return NAV_ITEMS.map((item) => `
      <button type="button" class="${extraClass} ${item.view === activeView ? 'is-active' : ''}" data-action="nav" data-view="${item.view}">
        <span class="nav-icon" aria-hidden="true">${item.icon}</span>
        <span class="nav-label">${item.label}</span>
      </button>`).join('');
  }

  function renderShell() {
    const shell = document.getElementById('app-shell');
    shell.innerHTML = `
      <aside class="sidebar">
        <div class="sidebar__brand">Controle Financeiro</div>
        <nav class="sidebar__nav" data-role="nav-desktop"></nav>
        <div class="sidebar__footer">
          <button type="button" class="button button--ghost button--full" data-action="tema">
            <span data-role="tema-icone"></span> <span data-role="tema-label"></span>
          </button>
          <button type="button" class="button button--ghost button--full" data-action="exportar">Exportar backup</button>
          <button type="button" class="button button--ghost button--full" data-action="importar">Importar backup</button>
          <button type="button" class="button button--ghost button--full button--danger" data-action="zerar">Zerar dados</button>
        </div>
      </aside>
      <main id="view-container" class="view-container"></main>
      <nav class="tabbar" data-role="nav-mobile"></nav>
    `;
  }

  function applyTema() {
    const tema = state.getTema();
    if (tema === 'sistema') delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = tema === 'escuro' ? 'dark' : 'light';
    const icone = document.querySelector('[data-role="tema-icone"]');
    const label = document.querySelector('[data-role="tema-label"]');
    if (icone) icone.textContent = TEMA_ICONE[tema];
    if (label) label.textContent = TEMA_LABEL[tema];
  }

  function render() {
    applyTema();
    const ui = state.getUI();
    document.querySelector('[data-role="nav-desktop"]').innerHTML = navHtml(ui.view, 'sidebar__link');
    document.querySelector('[data-role="nav-mobile"]').innerHTML = navHtml(ui.view, 'tabbar__link');

    const view = App.views[ui.view];
    const container = document.getElementById('view-container');
    if (view) view.render(container);
  }

  function handleImportFile(file) {
    App.storage.importFromFile(file)
      .then((novoEstado) => {
        state.replaceData(novoEstado);
        App.toast.show('Backup importado com sucesso.', 'sucesso');
      })
      .catch((err) => {
        App.toast.show(err.message || 'Não foi possível importar o arquivo.', 'erro');
      });
  }

  function wireShellEvents() {
    const shell = document.getElementById('app-shell');
    shell.onclick = (e) => {
      const nav = e.target.closest('[data-action="nav"]');
      if (nav) { state.setUI({ view: nav.dataset.view }); return; }

      const action = e.target.closest('[data-action]');
      if (!action) return;
      switch (action.dataset.action) {
        case 'tema':
          state.setTema(TEMA_CICLO[state.getTema()]);
          break;
        case 'exportar':
          App.storage.exportToFile(state.getData());
          App.toast.show('Backup exportado.', 'sucesso');
          break;
        case 'importar':
          document.getElementById('import-file-input').click();
          break;
        case 'zerar':
          if (window.confirm('Isso apaga TODOS os gastos, receitas e notas fiscais guardados neste navegador. Exporte um backup antes, se quiser manter os dados. Continuar?')) {
            state.resetAll();
            App.toast.show('Dados zerados.', 'info');
          }
          break;
        default:
          break;
      }
    };

    document.getElementById('import-file-input').addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) handleImportFile(file);
      e.target.value = '';
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    state.init();
    renderShell();
    wireShellEvents();
    state.subscribe(render);
    render();
  });
})();
