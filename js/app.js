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
    { view: 'dashboard', label: 'Painel', icon: 'grid' },
    { view: 'gastos', label: 'Gastos', icon: 'list' },
    { view: 'receitas', label: 'Receitas', icon: 'trending-up' },
    { view: 'notasFiscais', label: 'Notas fiscais', icon: 'file-text' },
  ];

  // Ciclo de temas: Automático -> Claro -> Escuro -> Oceano -> (volta).
  // "sistema" e "oceano" seguem o claro/escuro do aparelho; "claro"/"escuro"
  // são fixos. (Ver as variáveis de cor em css/styles.css.)
  const TEMA_CICLO = { sistema: 'claro', claro: 'escuro', escuro: 'oceano', oceano: 'rick', rick: 'starwars', starwars: 'sistema' };
  const TEMA_ICONE = { sistema: 'contrast', claro: 'sun', escuro: 'moon', oceano: 'waves', rick: 'portal', starwars: 'death-star' };
  const TEMA_LABEL = { sistema: 'Automático', claro: 'Claro', escuro: 'Escuro', oceano: 'Oceano', rick: 'Rick and Morty', starwars: 'Star Wars' };
  let ultimaViewRenderizada = null;

  function navHtml(activeView, extraClass) {
    return NAV_ITEMS.map((item) => `
      <button type="button" class="${extraClass} ${item.view === activeView ? 'is-active' : ''}" data-action="nav" data-view="${item.view}">
        <span class="nav-icon" aria-hidden="true">${App.icons.get(item.icon)}</span>
        <span class="nav-label">${item.label}</span>
      </button>`).join('');
  }

  // Barra inferior (mobile): navegação + botão "Ajustes". Esse botão dá acesso
  // a tema/exportar/importar/zerar no celular, já que a barra lateral (onde
  // essas ações ficam no desktop) é escondida em telas pequenas.
  function tabbarHtml(activeView) {
    return navHtml(activeView, 'tabbar__link') + `
      <button type="button" class="tabbar__link" data-action="ajustes">
        <span class="nav-icon" aria-hidden="true">${App.icons.get('settings')}</span>
        <span class="nav-label">Ajustes</span>
      </button>`;
  }

  function renderShell() {
    const shell = document.getElementById('app-shell');
    shell.innerHTML = `
      <aside class="sidebar">
        <div class="sidebar__brand">Controle Financeiro</div>
        <nav class="sidebar__nav" data-role="nav-desktop"></nav>
        <div class="sidebar__footer">
          <button type="button" class="button button--ghost button--full button--icon" data-action="tema">
            <span data-role="tema-icone"></span> <span data-role="tema-label"></span>
          </button>
          <button type="button" class="button button--ghost button--full button--icon" data-action="exportar">${App.icons.get('download')} Exportar backup</button>
          <button type="button" class="button button--ghost button--full button--icon" data-action="importar">${App.icons.get('upload')} Importar backup</button>
          <button type="button" class="button button--ghost button--full button--icon" data-action="gdrive">${App.icons.get('cloud')} <span data-role="gdrive-label">Google Drive</span></button>
          <button type="button" class="button button--ghost button--full button--icon button--danger" data-action="zerar">${App.icons.get('trash')} Zerar dados</button>
        </div>
      </aside>
      <main id="view-container" class="view-container"></main>
      <nav class="tabbar" data-role="nav-mobile"></nav>
    `;
  }

  function applyTema() {
    const tema = state.getTema();
    // data-theme controla a paleta no CSS. "sistema" e "oceano" não fixam
    // claro/escuro — deixam o prefers-color-scheme do aparelho decidir a
    // variante (por isso oceano tem versão clara e escura automaticamente).
    if (tema === 'sistema') delete document.documentElement.dataset.theme;
    else if (tema === 'oceano') document.documentElement.dataset.theme = 'oceano';
    else if (tema === 'rick') document.documentElement.dataset.theme = 'rick';
    else if (tema === 'starwars') document.documentElement.dataset.theme = 'starwars';
    else document.documentElement.dataset.theme = tema === 'escuro' ? 'dark' : 'light';
    const icone = document.querySelector('[data-role="tema-icone"]');
    const label = document.querySelector('[data-role="tema-label"]');
    if (icone) icone.innerHTML = App.icons.get(TEMA_ICONE[tema]);
    if (label) label.textContent = TEMA_LABEL[tema];
  }

  function render() {
    applyTema();
    const ui = state.getUI();
    document.querySelector('[data-role="nav-desktop"]').innerHTML = navHtml(ui.view, 'sidebar__link');
    document.querySelector('[data-role="nav-mobile"]').innerHTML = tabbarHtml(ui.view);

    const view = App.views[ui.view];
    const container = document.getElementById('view-container');
    const trocouDeTela = ui.view !== ultimaViewRenderizada;
    ultimaViewRenderizada = ui.view;

    const desenhar = () => { if (view) view.render(container); };

    // A transição animada só entra ao trocar de tela (Painel -> Gastos etc.)
    // — em qualquer outra atualização (filtro, novo lançamento, mudar o mês)
    // o redesenho continua instantâneo, sem "flashar" a tela toda.
    if (trocouDeTela && typeof document.startViewTransition === 'function') {
      document.startViewTransition(desenhar);
    } else {
      desenhar();
    }
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

  // Executa uma ação global. Compartilhado entre a barra lateral (desktop) e
  // o modal de Ajustes (mobile). Devolve true se a ação fecha um contexto
  // (usado pelo modal pra saber se deve se fechar).
  function executarAcao(acao) {
    switch (acao) {
      case 'tema':
        state.setTema(TEMA_CICLO[state.getTema()]);
        return false; // mantém o menu/modal aberto pra ver o tema trocar
      case 'exportar':
        App.storage.exportToFile(state.getData());
        App.toast.show('Backup exportado.', 'sucesso');
        return true;
      case 'importar':
        document.getElementById('import-file-input').click();
        return true;
      case 'zerar':
        if (window.confirm('Isso apaga TODOS os gastos, receitas e notas fiscais guardados neste navegador. Exporte um backup antes, se quiser manter os dados. Continuar?')) {
          state.resetAll();
          App.toast.show('Dados zerados.', 'info');
        }
        return true;
      case 'gdrive':
        abrirGoogleDrive();
        return false;
      case 'ajustes':
        abrirAjustes();
        return false;
      default:
        return false;
    }
  }

  // Modal de Ajustes (usado no mobile, onde a barra lateral não aparece).
  // Reúne tema + backup + zerar, reaproveitando executarAcao().
  function abrirAjustes() {
    const temaAtual = state.getTema();
    const bodyHtml = `
      <div class="ajustes">
        <button type="button" class="button button--ghost button--full button--icon" data-acao="tema">
          <span data-role="ajustes-tema-icone">${App.icons.get(TEMA_ICONE[temaAtual])}</span>
          <span data-role="ajustes-tema-label">Tema: ${TEMA_LABEL[temaAtual]}</span>
        </button>
        <button type="button" class="button button--ghost button--full button--icon" data-acao="exportar">${App.icons.get('download')} Exportar backup</button>
        <button type="button" class="button button--ghost button--full button--icon" data-acao="importar">${App.icons.get('upload')} Importar backup</button>
        <button type="button" class="button button--ghost button--full button--icon" data-acao="gdrive">${App.icons.get('cloud')} Google Drive</button>
        <button type="button" class="button button--ghost button--full button--icon button--danger" data-acao="zerar">${App.icons.get('trash')} Zerar dados</button>
      </div>`;
    App.modal.open({
      title: 'Ajustes',
      bodyHtml,
      onMount(dialog) {
        dialog.addEventListener('click', (e) => {
          const btn = e.target.closest('[data-acao]');
          if (!btn) return;
          const fecha = executarAcao(btn.dataset.acao);
          if (btn.dataset.acao === 'tema') {
            // Atualiza o rótulo/ícone do tema dentro do próprio modal.
            const novo = state.getTema();
            dialog.querySelector('[data-role="ajustes-tema-icone"]').innerHTML = App.icons.get(TEMA_ICONE[novo]);
            dialog.querySelector('[data-role="ajustes-tema-label"]').textContent = `Tema: ${TEMA_LABEL[novo]}`;
          } else if (fecha) {
            App.modal.close();
          }
        });
      },
    });
  }

  // Modal de sincronização com o Google Drive. Deixa o usuário colar o Client
  // ID (uma vez), conectar/desconectar e enviar/baixar o backup do Drive.
  function abrirGoogleDrive() {
    const gdrive = App.gdrive;
    const origem = window.location.origin;

    function statusHtml() {
      const conectado = gdrive.isConnected();
      const ultimo = gdrive.getLastSync();
      const quando = ultimo ? new Date(ultimo).toLocaleString('pt-BR') : null;
      return `
        <p class="gdrive-status">
          <span class="pill pill--${conectado ? 'pago' : 'pendente'}">${conectado ? 'Conectado' : 'Desconectado'}</span>
          ${quando ? `<span class="data-list__obs">Última sincronização: ${utils.escapeHtml(quando)}</span>` : ''}
        </p>`;
    }

    const bodyHtml = `
      <div class="gdrive">
        <p class="form__hint">
          Guarda uma cópia do seu backup numa pasta privada do app no seu Google Drive.
          Os dados vão direto do navegador para o seu Drive — nenhum servidor no meio.
        </p>

        <label>Client ID do Google
          <input type="text" name="gdriveClientId" placeholder="xxxxxxxx.apps.googleusercontent.com"
                 value="${utils.escapeHtml(gdrive.getClientId())}" autocomplete="off" spellcheck="false" />
        </label>
        <div class="form__actions form__actions--start">
          <button type="button" class="button button--ghost" data-g="salvar-id">Salvar Client ID</button>
        </div>

        <details class="gdrive-help">
          <summary>Como obter o Client ID (uma vez só)</summary>
          <ol>
            <li>Acesse <strong>console.cloud.google.com</strong> e crie um projeto (ou use um existente).</li>
            <li>Em <strong>APIs e serviços → Biblioteca</strong>, ative a <strong>Google Drive API</strong>.</li>
            <li>Em <strong>Tela de consentimento OAuth</strong>, configure como "Externo" e adicione seu e-mail em usuários de teste.</li>
            <li>Em <strong>Credenciais → Criar credenciais → ID do cliente OAuth</strong>, tipo <strong>Aplicativo da Web</strong>.</li>
            <li>Em <strong>Origens JavaScript autorizadas</strong>, adicione: <code>${utils.escapeHtml(origem)}</code></li>
            <li>Copie o <strong>Client ID</strong> gerado e cole no campo acima.</li>
          </ol>
        </details>

        <div data-role="gdrive-status">${statusHtml()}</div>

        <div class="form__actions form__actions--stack">
          <button type="button" class="button button--primary button--full button--icon" data-g="conectar">${App.icons.get('cloud')} <span data-role="conectar-label">Conectar com Google</span></button>
          <button type="button" class="button button--ghost button--full button--icon" data-g="enviar">${App.icons.get('upload')} Enviar backup para o Drive</button>
          <button type="button" class="button button--ghost button--full button--icon" data-g="baixar">${App.icons.get('download')} Baixar backup do Drive</button>
          <button type="button" class="button button--ghost button--full button--icon" data-g="desconectar">${App.icons.get('x')} Desconectar</button>
        </div>
      </div>`;

    App.modal.open({
      title: 'Sincronizar com Google Drive',
      bodyHtml,
      onMount(dialog) {
        const statusWrap = dialog.querySelector('[data-role="gdrive-status"]');
        const conectarLabel = dialog.querySelector('[data-role="conectar-label"]');
        const idInput = dialog.querySelector('[name="gdriveClientId"]');

        function refresh() {
          statusWrap.innerHTML = statusHtml();
          conectarLabel.textContent = gdrive.isConnected() ? 'Reconectar' : 'Conectar com Google';
        }

        dialog.addEventListener('click', (e) => {
          const btn = e.target.closest('[data-g]');
          if (!btn) return;
          const acao = btn.dataset.g;

          if (acao === 'salvar-id') {
            gdrive.setClientId(idInput.value);
            App.toast.show('Client ID salvo.', 'sucesso');
            refresh();
            return;
          }
          if (acao === 'conectar') {
            if (!gdrive.getClientId()) { App.toast.show('Cole e salve o Client ID primeiro.', 'erro'); return; }
            btn.disabled = true;
            gdrive.connect()
              .then(() => { App.toast.show('Conectado ao Google Drive.', 'sucesso'); refresh(); })
              .catch((err) => App.toast.show(err.message || 'Não foi possível conectar.', 'erro'))
              .finally(() => { btn.disabled = false; });
            return;
          }
          if (acao === 'desconectar') {
            gdrive.disconnect();
            App.toast.show('Desconectado.', 'info');
            refresh();
            return;
          }
          if (acao === 'enviar') {
            btn.disabled = true;
            gdrive.upload(state.getData())
              .then(() => { App.toast.show('Backup enviado para o Drive.', 'sucesso'); refresh(); })
              .catch((err) => App.toast.show(err.message || 'Falha ao enviar.', 'erro'))
              .finally(() => { btn.disabled = false; });
            return;
          }
          if (acao === 'baixar') {
            if (!window.confirm('Isso substitui os dados deste navegador pelos do Drive. Continuar?')) return;
            btn.disabled = true;
            gdrive.download()
              .then((remoto) => {
                if (!remoto) { App.toast.show('Nenhum backup encontrado no Drive ainda.', 'info'); return; }
                state.replaceData(App.storage.normalize(remoto));
                App.toast.show('Backup baixado do Drive.', 'sucesso');
                refresh();
              })
              .catch((err) => App.toast.show(err.message || 'Falha ao baixar.', 'erro'))
              .finally(() => { btn.disabled = false; });
          }
        });
      },
    });
  }

  function wireShellEvents() {
    const shell = document.getElementById('app-shell');
    shell.onclick = (e) => {
      const nav = e.target.closest('[data-action="nav"]');
      if (nav) { state.setUI({ view: nav.dataset.view }); return; }

      const action = e.target.closest('[data-action]');
      if (!action) return;
      executarAcao(action.dataset.action);
    };

    document.getElementById('import-file-input').addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) handleImportFile(file);
      e.target.value = '';
    });
  }

  // Auto-sync: quando conectado ao Drive, envia o backup pouco depois de cada
  // mudança nos dados. Compara o JSON serializado pra não subir à toa (troca de
  // tela/filtro não altera os dados). Debounce evita um upload por tecla.
  function wireAutoSync() {
    let ultimoEnviado = JSON.stringify(state.getData());
    let timer = null;
    state.subscribe(() => {
      if (!App.gdrive || !App.gdrive.isConnected()) return;
      const atual = JSON.stringify(state.getData());
      if (atual === ultimoEnviado) return;
      clearTimeout(timer);
      timer = setTimeout(() => {
        ultimoEnviado = atual;
        App.gdrive.upload(state.getData()).catch(() => { /* silencioso; usuário pode enviar manualmente */ });
      }, 2000);
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    state.init();
    renderShell();
    wireShellEvents();
    state.subscribe(render);
    wireAutoSync();
    render();
  });
})();
