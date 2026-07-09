/*
 * Tela de Gastos: lista com filtros combináveis + modal de criação/edição.
 * É a tela mais usada no dia a dia, então "marcar como pago" é sempre 1 clique.
 */
window.App = window.App || {};
App.views = App.views || {};

App.views.gastos = (function () {
  const utils = App.utils;
  const state = App.state;

  let mostrarMaisFiltros = false;
  let debounceBusca = null;

  const NOVA_CATEGORIA_VALOR = '__nova__';

  function mesesDisponiveis() {
    const meses = new Set();
    state.getData().gastos.forEach((g) => meses.add(g.mesReferencia));
    meses.add(utils.currentMonthRef());
    return Array.from(meses).filter(Boolean).sort().reverse();
  }

  function render(container) {
    const focused = container.querySelector(':focus');
    const focusInfo = focused && focused.dataset.preserve
      ? { name: focused.dataset.preserve, start: focused.selectionStart, end: focused.selectionEnd }
      : null;

    const f = state.getFiltros();
    const lista = state.gastosFiltrados();
    const categorias = state.listCategorias();
    const totalFiltrado = state.totais(lista);
    const filtrosAtivos = !!(f.mesReferencia || f.dataInicio || f.dataFim || f.categorias.length || f.tipos.length || f.status.length || f.busca);

    container.innerHTML = `
      <div class="view-header">
        <h1>Gastos</h1>
        <button type="button" class="button button--primary" data-action="novo-gasto">+ Novo gasto</button>
      </div>

      <div class="filter-bar">
        <input type="search" class="input input--search" placeholder="Buscar por descrição ou observação" value="${utils.escapeHtml(f.busca)}" data-preserve="busca" data-field="busca" />

        <select class="input" data-field="mesReferencia">
          <option value="">Todos os meses</option>
          ${mesesDisponiveis().map((m) => `<option value="${m}" ${f.mesReferencia === m ? 'selected' : ''}>${utils.escapeHtml(utils.monthRefToLabel(m))}</option>`).join('')}
        </select>

        <input type="date" class="input" data-field="dataInicio" value="${f.dataInicio}" title="Vencimento de" />
        <span class="filter-bar__sep">até</span>
        <input type="date" class="input" data-field="dataFim" value="${f.dataFim}" title="Vencimento até" />

        <details class="filter-dropdown">
          <summary class="button button--ghost">Categoria ${f.categorias.length ? `(${f.categorias.length})` : ''}</summary>
          <div class="filter-dropdown__panel">
            ${categorias.map((c) => `
              <label class="checkbox-row">
                <input type="checkbox" data-toggle="categorias" value="${c.id}" ${f.categorias.includes(c.id) ? 'checked' : ''} />
                ${utils.escapeHtml(c.nome)}
              </label>`).join('')}
          </div>
        </details>

        <div class="chip-group" data-group="tipos">
          ${[['fixo', 'Fixo'], ['variavel', 'Variável']].map(([v, label]) => `
            <button type="button" class="chip ${f.tipos.includes(v) ? 'is-active' : ''}" data-toggle="tipos" data-value="${v}">${label}</button>`).join('')}
        </div>

        <div class="chip-group" data-group="status">
          ${[['pago', 'Pago'], ['pendente', 'Pendente'], ['atrasado', 'Atrasado']].map(([v, label]) => `
            <button type="button" class="chip ${f.status.includes(v) ? 'is-active' : ''}" data-toggle="status" data-value="${v}">${label}</button>`).join('')}
        </div>

        ${filtrosAtivos ? '<button type="button" class="button button--ghost" data-action="limpar-filtros">Limpar filtros</button>' : ''}
      </div>

      <div class="list-summary">
        ${lista.length} gasto${lista.length === 1 ? '' : 's'} · Total ${utils.formatCurrency(totalFiltrado.totalLiquido)} ·
        Pago ${utils.formatCurrency(totalFiltrado.totalPago)} · Pendente ${utils.formatCurrency(totalFiltrado.totalPendente)}
      </div>

      ${renderLista(lista)}
    `;

    if (focusInfo) {
      const el = container.querySelector(`[data-preserve="${focusInfo.name}"]`);
      if (el) {
        el.focus();
        if (typeof el.setSelectionRange === 'function') el.setSelectionRange(focusInfo.start, focusInfo.end);
      }
    }

    wireEvents(container);
  }

  function renderLista(lista) {
    if (!lista.length) {
      return '<p class="empty-hint empty-hint--block">Nenhum gasto encontrado com os filtros atuais.</p>';
    }
    return `
      <div class="data-list">
        <div class="data-list__header">
          <span>Descrição</span><span>Categoria</span><span>Tipo</span><span>Valor</span><span>Vencimento</span><span>Mês ref.</span><span>Status</span><span></span>
        </div>
        ${lista.map((g) => {
          const statusEfetivo = state.statusEfetivo(g);
          return `
          <div class="data-list__row">
            <span class="data-list__descricao">
              ${utils.escapeHtml(g.descricao)}
              ${g.observacao ? `<span class="data-list__obs">${utils.escapeHtml(g.observacao)}</span>` : ''}
            </span>
            <span>${utils.escapeHtml(state.categoriaNome(g.categoriaId))}</span>
            <span>${g.tipo === 'fixo' ? 'Fixo' : 'Variável'}</span>
            <span class="valor-mono">${utils.formatCurrency(state.valorLiquido(g))}</span>
            <span>${utils.formatDate(g.vencimento)}</span>
            <span>${utils.escapeHtml(utils.monthRefToShortLabel(g.mesReferencia))}</span>
            <span><span class="pill pill--${statusEfetivo}">${utils.statusLabel(statusEfetivo)}</span></span>
            <span class="data-list__acoes">
              ${g.status === 'pendente'
                ? `<button type="button" class="icon-button" title="Marcar como pago" data-action="pagar" data-id="${g.id}">✓</button>`
                : `<button type="button" class="icon-button" title="Marcar como pendente" data-action="rependente" data-id="${g.id}">↺</button>`}
              <button type="button" class="icon-button" title="Editar" data-action="editar" data-id="${g.id}">✎</button>
              <button type="button" class="icon-button" title="Excluir" data-action="excluir" data-id="${g.id}">🗑</button>
            </span>
          </div>`;
        }).join('')}
      </div>`;
  }

  // -----------------------------------------------------------------------
  // Modal de criação/edição
  // -----------------------------------------------------------------------

  function opcoesCategoria(categoriaSelecionada) {
    const categorias = state.listCategorias();
    return `
      ${categorias.map((c) => `<option value="${c.id}" ${c.id === categoriaSelecionada ? 'selected' : ''}>${utils.escapeHtml(c.nome)}</option>`).join('')}
      <option value="${NOVA_CATEGORIA_VALOR}">+ Nova categoria…</option>`;
  }

  function abrirModalGasto(gastoExistente) {
    const g = gastoExistente || {
      descricao: '', categoriaId: '', tipo: 'variavel', valor: '', desconto: '',
      vencimento: utils.todayISO(), status: 'pendente', dataPagamento: '',
      mesReferencia: utils.currentMonthRef(), observacao: '',
    };

    const bodyHtml = `
      <form class="form" data-form="gasto">
        <div class="form__row">
          <label>Descrição
            <input type="text" name="descricao" required value="${utils.escapeHtml(g.descricao)}" placeholder="Ex.: Nubank" />
          </label>
        </div>

        <div class="form__row form__row--2">
          <label>Categoria
            <select name="categoriaId" required>
              <option value="" disabled ${g.categoriaId ? '' : 'selected'}>Selecione…</option>
              ${opcoesCategoria(g.categoriaId)}
            </select>
          </label>
          <label>Tipo
            <select name="tipo">
              <option value="variavel" ${g.tipo === 'variavel' ? 'selected' : ''}>Variável</option>
              <option value="fixo" ${g.tipo === 'fixo' ? 'selected' : ''}>Fixo</option>
            </select>
          </label>
        </div>

        <div class="form__row is-hidden" data-field-wrap="novaCategoria">
          <label>Nome da nova categoria
            <input type="text" name="novaCategoria" placeholder="Ex.: Educação" />
          </label>
        </div>

        <div class="form__row form__row--2">
          <label>Valor (R$)
            <input type="number" name="valor" step="0.01" min="0" required value="${g.valor}" />
          </label>
          <label>Desconto (opcional)
            <input type="number" name="desconto" step="0.01" min="0" value="${g.desconto || ''}" />
          </label>
        </div>

        <div class="form__row form__row--2">
          <label>Vencimento
            <input type="date" name="vencimento" required value="${g.vencimento}" />
          </label>
          <label>Mês de referência
            <input type="month" name="mesReferencia" required value="${g.mesReferencia}" />
          </label>
        </div>

        <div class="form__row form__row--2">
          <label>Status
            <select name="status">
              <option value="pendente" ${g.status === 'pendente' ? 'selected' : ''}>Pendente</option>
              <option value="pago" ${g.status === 'pago' ? 'selected' : ''}>Pago</option>
            </select>
          </label>
          <label data-field-wrap="dataPagamento" class="${g.status === 'pago' ? '' : 'is-hidden'}">Data de pagamento
            <input type="date" name="dataPagamento" value="${g.dataPagamento || utils.todayISO()}" />
          </label>
        </div>

        <div class="form__row">
          <label>Observação (opcional)
            <textarea name="observacao" rows="2" placeholder="Ex.: Referente a junho e julho">${utils.escapeHtml(g.observacao || '')}</textarea>
          </label>
        </div>

        <div class="form__actions">
          <button type="button" class="button button--ghost" data-action="closeModal">Cancelar</button>
          <button type="submit" class="button button--primary">Salvar</button>
        </div>
      </form>`;

    App.modal.open({
      title: gastoExistente ? 'Editar gasto' : 'Novo gasto',
      bodyHtml,
      onMount(dialog) {
        const form = dialog.querySelector('form');
        const categoriaSelect = form.elements.categoriaId;
        const novaCategoriaWrap = dialog.querySelector('[data-field-wrap="novaCategoria"]');
        const statusSelect = form.elements.status;
        const dataPagamentoWrap = dialog.querySelector('[data-field-wrap="dataPagamento"]');

        categoriaSelect.addEventListener('change', () => {
          novaCategoriaWrap.classList.toggle('is-hidden', categoriaSelect.value !== NOVA_CATEGORIA_VALOR);
        });
        statusSelect.addEventListener('change', () => {
          dataPagamentoWrap.classList.toggle('is-hidden', statusSelect.value !== 'pago');
        });

        form.onsubmit = (e) => {
          e.preventDefault();
          const fd = new FormData(form);
          let categoriaId = fd.get('categoriaId');
          if (categoriaId === NOVA_CATEGORIA_VALOR) {
            const nome = String(fd.get('novaCategoria') || '').trim();
            if (!nome) {
              form.elements.novaCategoria.focus();
              return;
            }
            categoriaId = state.addCategoria(nome).id;
          }
          const status = fd.get('status');
          const payload = {
            descricao: String(fd.get('descricao') || '').trim(),
            categoriaId,
            tipo: fd.get('tipo'),
            valor: Number(fd.get('valor')) || 0,
            desconto: Number(fd.get('desconto')) || 0,
            vencimento: fd.get('vencimento'),
            mesReferencia: fd.get('mesReferencia'),
            status,
            dataPagamento: status === 'pago' ? (fd.get('dataPagamento') || utils.todayISO()) : '',
            observacao: String(fd.get('observacao') || '').trim(),
          };
          if (gastoExistente) {
            state.updateGasto(gastoExistente.id, payload);
            App.toast.show('Gasto atualizado.', 'sucesso');
          } else {
            state.addGasto(payload);
            App.toast.show('Gasto adicionado.', 'sucesso');
          }
          App.modal.close();
        };
      },
    });
  }

  function wireEvents(container) {
    container.onclick = (e) => {
      const chip = e.target.closest('[data-toggle]');
      if (chip && chip.tagName === 'BUTTON') {
        const grupo = chip.dataset.toggle;
        const valor = chip.dataset.value;
        const atual = state.getFiltros()[grupo];
        const novo = atual.includes(valor) ? atual.filter((v) => v !== valor) : [...atual, valor];
        state.setFiltro(grupo, novo);
        return;
      }

      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      const { action, id } = btn.dataset;
      if (action === 'novo-gasto') abrirModalGasto(null);
      else if (action === 'editar') abrirModalGasto(state.getData().gastos.find((g) => g.id === id));
      else if (action === 'pagar') { state.marcarGastoPago(id); App.toast.show('Gasto marcado como pago.', 'sucesso'); }
      else if (action === 'rependente') state.marcarGastoPendente(id);
      else if (action === 'excluir') {
        if (window.confirm('Excluir este gasto? Essa ação não pode ser desfeita.')) {
          state.deleteGasto(id);
          App.toast.show('Gasto excluído.', 'info');
        }
      } else if (action === 'limpar-filtros') {
        state.limparFiltros();
      }
    };

    container.onchange = (e) => {
      const el = e.target;
      if (el.dataset.toggle === 'categorias') {
        const atual = state.getFiltros().categorias;
        const novo = el.checked ? [...atual, el.value] : atual.filter((v) => v !== el.value);
        state.setFiltro('categorias', novo);
        return;
      }
      if (el.dataset.field && el.dataset.field !== 'busca') {
        state.setFiltro(el.dataset.field, el.value);
      }
    };

    container.oninput = (e) => {
      if (e.target.dataset.field === 'busca') {
        clearTimeout(debounceBusca);
        const valor = e.target.value;
        debounceBusca = setTimeout(() => state.setFiltro('busca', valor), 250);
      }
    };
  }

  return { render };
})();
