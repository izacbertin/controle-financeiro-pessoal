/*
 * Cadastro de receitas por mês de referência. Mais de um lançamento no mesmo
 * mês é permitido de propósito (ex.: salário fixo + um extra) — o Consolidado
 * soma tudo que estiver no mesmo mês.
 */
window.App = window.App || {};
App.views = App.views || {};

App.views.receitas = (function () {
  const utils = App.utils;
  const state = App.state;

  let filtroAno = '';

  function render(container) {
    const todas = state.getData().receitas.slice().sort((a, b) => (a.mesReferencia < b.mesReferencia ? 1 : -1));
    const anos = state.anosDisponiveis();
    const lista = filtroAno ? todas.filter((r) => utils.yearFromMonthRef(r.mesReferencia) === Number(filtroAno)) : todas;
    const total = utils.sum(lista, (r) => r.valor);

    container.innerHTML = `
      <div class="view-header">
        <h1>Receitas</h1>
        <button type="button" class="button button--primary" data-action="nova-receita">+ Nova receita</button>
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
          <div class="data-list__header"><span>Mês de referência</span><span>Valor</span><span>Observação</span><span></span></div>
          ${lista.map((r) => `
            <div class="data-list__row">
              <span>${utils.escapeHtml(utils.monthRefToLabel(r.mesReferencia))}</span>
              <span class="valor-mono">${utils.formatCurrency(r.valor)}</span>
              <span>${utils.escapeHtml(r.observacao || '—')}</span>
              <span class="data-list__acoes">
                <button type="button" class="icon-button" title="Editar" data-action="editar" data-id="${r.id}">✎</button>
                <button type="button" class="icon-button" title="Excluir" data-action="excluir" data-id="${r.id}">🗑</button>
              </span>
            </div>`).join('')}
        </div>` : '<p class="empty-hint empty-hint--block">Nenhuma receita cadastrada ainda.</p>'}
    `;

    wireEvents(container);
  }

  function abrirModalReceita(receitaExistente) {
    const r = receitaExistente || { mesReferencia: utils.currentMonthRef(), valor: '', observacao: '' };
    const bodyHtml = `
      <form class="form" data-form="receita">
        <div class="form__row form__row--2">
          <label>Mês de referência
            <input type="month" name="mesReferencia" required value="${r.mesReferencia}" />
          </label>
          <label>Valor (R$)
            <input type="number" name="valor" step="0.01" min="0" required value="${r.valor}" />
          </label>
        </div>
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
        form.onsubmit = (e) => {
          e.preventDefault();
          const fd = new FormData(form);
          const payload = {
            mesReferencia: fd.get('mesReferencia'),
            valor: Number(fd.get('valor')) || 0,
            observacao: String(fd.get('observacao') || '').trim(),
          };
          if (receitaExistente) {
            state.updateReceita(receitaExistente.id, payload);
            App.toast.show('Receita atualizada.', 'sucesso');
          } else {
            state.addReceita(payload);
            App.toast.show('Receita adicionada.', 'sucesso');
          }
          App.modal.close();
        };
      },
    });
  }

  function wireEvents(container) {
    container.onclick = (e) => {
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
