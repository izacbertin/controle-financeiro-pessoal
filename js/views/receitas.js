/*
 * Cadastro de receitas por mês de referência. Mais de um lançamento no mesmo
 * mês é permitido de propósito (ex.: salário fixo + um extra) — o Consolidado
 * soma tudo que estiver no mesmo mês.
 *
 * As notas fiscais (tela "Notas fiscais") são um controle SEPARADO de
 * faturamento emitido — não entram automaticamente como receita. Isso é de
 * propósito: assim dá pra programar os gastos de um mês antes de ter emitido
 * a nota daquele mês, lançando a receita esperada manualmente.
 */
window.App = window.App || {};
App.views = App.views || {};

App.views.receitas = (function () {
  const utils = App.utils;
  const state = App.state;

  let filtroAno = '';
  let ordenacao = { coluna: 'mesReferencia', dir: 'desc' };

  const CATEGORIAS_RECEITA = ['Salário', 'Faturamento', 'Empréstimo', 'Extra', 'Outros'];

  function th(coluna, rotulo) {
    const ativo = ordenacao.coluna === coluna;
    const seta = ativo ? (ordenacao.dir === 'asc' ? ' ▲' : ' ▼') : '';
    return `<span class="th ${ativo ? 'is-sorted' : ''}" data-sort="${coluna}">${rotulo}${seta}</span>`;
  }

  function ordenar(lista) {
    const mult = ordenacao.dir === 'asc' ? 1 : -1;
    const val = (r) => {
      switch (ordenacao.coluna) {
        case 'categoria': return (r.categoria || '').toLowerCase();
        case 'valor': return r.valor || 0;
        case 'observacao': return (r.observacao || '').toLowerCase();
        case 'mesReferencia':
        default: return r.mesReferencia || '';
      }
    };
    return lista.slice().sort((a, b) => {
      const va = val(a); const vb = val(b);
      if (va < vb) return -1 * mult;
      if (va > vb) return 1 * mult;
      return 0;
    });
  }

  function render(container) {
    const todas = state.getData().receitas.slice().sort((a, b) => (a.mesReferencia < b.mesReferencia ? 1 : -1));
    const anos = state.anosDisponiveis();
    const listaFiltrada = filtroAno ? todas.filter((r) => utils.yearFromMonthRef(r.mesReferencia) === Number(filtroAno)) : todas;
    const lista = ordenar(listaFiltrada);
    const total = utils.sum(lista, (r) => r.valor);

    container.innerHTML = `
      <div class="view-header">
        <h1>Receitas</h1>
        <button type="button" class="button button--primary button--icon" data-action="nova-receita">${App.icons.get('plus')} Nova receita</button>
      </div>

      <div class="filter-bar">
        <select class="input" data-field="ano">
          <option value="">Todos os anos</option>
          ${anos.map((a) => `<option value="${a}" ${String(a) === filtroAno ? 'selected' : ''}>${a}</option>`).join('')}
        </select>
      </div>

      <div class="list-summary">${lista.length} lançamento${lista.length === 1 ? '' : 's'} · Total ${utils.formatCurrency(total)}</div>

      ${lista.length ? `
        <div class="data-list data-list--receitas">
          <div class="data-list__header">${th('mesReferencia', 'Mês de referência')}${th('categoria', 'Categoria')}${th('valor', 'Valor')}${th('observacao', 'Observação')}<span></span></div>
          ${lista.map((r) => `
            <div class="data-list__row">
              <span>${utils.escapeHtml(utils.monthRefToLabel(r.mesReferencia))}</span>
              <span>${r.categoria ? `<span class="pill pill--pendente">${utils.escapeHtml(r.categoria)}</span>` : '—'}</span>
              <span class="valor-mono">${utils.formatCurrency(r.valor)}</span>
              <span>${utils.escapeHtml(r.observacao || '—')}</span>
              <span class="data-list__acoes">
                <button type="button" class="icon-button" title="Editar" data-action="editar" data-id="${r.id}">${App.icons.get('pencil')}</button>
                <button type="button" class="icon-button" title="Excluir" data-action="excluir" data-id="${r.id}">${App.icons.get('trash')}</button>
              </span>
            </div>`).join('')}
        </div>` : '<p class="empty-hint empty-hint--block">Nenhuma receita cadastrada ainda.</p>'}
    `;

    wireEvents(container);
  }

  function abrirModalReceita(receitaExistente) {
    const r = receitaExistente || { mesReferencia: utils.currentMonthRef(), valor: '', observacao: '', categoria: 'Salário' };
    const catAtual = r.categoria || 'Salário';
    const bodyHtml = `
      <form class="form" data-form="receita">
        <div class="form__row form__row--2">
          <label>Categoria
            <select name="categoria">
              ${CATEGORIAS_RECEITA.map((c) => `<option value="${c}" ${c === catAtual ? 'selected' : ''}>${c}</option>`).join('')}
            </select>
          </label>
          <label>Mês de referência
            <input type="month" name="mesReferencia" required value="${r.mesReferencia}" />
          </label>
        </div>
        <div class="form__row">
          <label><span data-role="valor-label">Valor (R$)</span>
            <input type="number" name="valor" step="0.01" min="0" required value="${r.valor}" />
          </label>
        </div>

        ${receitaExistente ? '' : `
        <div class="is-hidden" data-field-wrap="emprestimo">
          <p class="info-banner">Empréstimo: além de lançar o valor recebido na receita, o app cria as parcelas automaticamente na tela de Gastos.</p>
          <div class="form__row form__row--2">
            <label>Nº de parcelas
              <input type="number" name="parcelas" min="1" max="120" value="12" />
            </label>
            <label>Valor de cada parcela (R$)
              <input type="number" name="valorParcela" step="0.01" min="0" />
            </label>
          </div>
          <div class="form__row">
            <label>Vencimento da 1ª parcela
              <input type="date" name="vencimentoParcela" value="${utils.todayISO()}" />
            </label>
          </div>
        </div>`}

        <div class="form__row">
          <label>Observação (opcional)
            <input type="text" name="observacao" placeholder="Ex.: Salário + extra de freelance" value="${utils.escapeHtml(r.observacao || '')}" />
          </label>
        </div>
        <div class="form__actions">
          <button type="button" class="button button--ghost" data-action="closeModal">Cancelar</button>
          <button type="submit" class="button button--primary">Salvar</button>
        </div>
      </form>`;

    App.modal.open({
      title: receitaExistente ? 'Editar receita' : 'Nova receita',
      bodyHtml,
      onMount(dialog) {
        const form = dialog.querySelector('form');
        const categoriaSelect = form.elements.categoria;
        const emprestimoWrap = dialog.querySelector('[data-field-wrap="emprestimo"]');
        const valorLabel = dialog.querySelector('[data-role="valor-label"]');

        function atualizarEmprestimo() {
          const ehEmprestimo = categoriaSelect.value === 'Empréstimo';
          if (emprestimoWrap) emprestimoWrap.classList.toggle('is-hidden', !ehEmprestimo);
          if (valorLabel) valorLabel.textContent = ehEmprestimo ? 'Valor recebido do empréstimo (R$)' : 'Valor (R$)';
        }
        categoriaSelect.addEventListener('change', atualizarEmprestimo);
        atualizarEmprestimo();

        form.onsubmit = (e) => {
          e.preventDefault();
          const fd = new FormData(form);
          const categoria = fd.get('categoria');
          const payload = {
            mesReferencia: fd.get('mesReferencia'),
            valor: Number(fd.get('valor')) || 0,
            observacao: String(fd.get('observacao') || '').trim(),
            categoria,
          };
          if (receitaExistente) {
            state.updateReceita(receitaExistente.id, payload);
            App.toast.show('Receita atualizada.', 'sucesso');
            App.modal.close();
            return;
          }

          state.addReceita(payload);

          // Empréstimo: gera as parcelas automaticamente nos Gastos.
          if (categoria === 'Empréstimo') {
            const parcelas = Math.max(1, Math.min(120, Number(fd.get('parcelas')) || 1));
            const valorParcela = Number(fd.get('valorParcela')) || 0;
            const vencimento = fd.get('vencimentoParcela') || utils.todayISO();
            if (valorParcela > 0) {
              const categoriaId = state.addCategoria('Empréstimo').id;
              const descricao = payload.observacao ? `Empréstimo — ${payload.observacao}` : 'Empréstimo';
              const criados = state.addGastosLote({
                descricao,
                categoriaId,
                tipo: 'fixo',
                valor: valorParcela,
                desconto: 0,
                vencimento,
                mesReferencia: utils.monthRefFromDate(vencimento),
                status: 'pendente',
                dataPagamento: '',
                observacao: '',
              }, { modo: 'parcelado', quantidade: parcelas });
              App.toast.show(`Receita lançada + ${criados.length} parcelas criadas nos Gastos.`, 'sucesso');
              App.modal.close();
              return;
            }
          }
          App.toast.show('Receita adicionada.', 'sucesso');
          App.modal.close();
        };
      },
    });
  }

  function wireEvents(container) {
    container.onclick = (e) => {
      const cabecalho = e.target.closest('[data-sort]');
      if (cabecalho) {
        const col = cabecalho.dataset.sort;
        if (ordenacao.coluna === col) ordenacao.dir = ordenacao.dir === 'asc' ? 'desc' : 'asc';
        else ordenacao = { coluna: col, dir: ['valor', 'mesReferencia'].includes(col) ? 'desc' : 'asc' };
        render(container);
        return;
      }
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      const { action, id } = btn.dataset;
      if (action === 'nova-receita') abrirModalReceita(null);
      else if (action === 'editar') abrirModalReceita(state.getData().receitas.find((r) => r.id === id));
      else if (action === 'excluir') {
        if (window.confirm('Excluir esta receita?')) {
          state.deleteReceita(id);
          App.toast.show('Receita excluída.', 'info');
        }
      }
    };
    container.onchange = (e) => {
      if (e.target.dataset.field === 'ano') {
        filtroAno = e.target.value;
        render(container);
      }
    };
  }

  return { render };
})();
