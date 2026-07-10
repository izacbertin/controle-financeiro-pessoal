/*
 * Controle de notas fiscais emitidas (uso como MEI): mês/data de emissão,
 * número da NF e valor. CRUD simples, sem regra de negócio adicional.
 */
window.App = window.App || {};
App.views = App.views || {};

App.views.notasFiscais = (function () {
  const utils = App.utils;
  const state = App.state;

  let filtroAno = String(utils.currentYear());

  function render(container) {
    const todas = state.getData().notasFiscais.slice().sort((a, b) => (a.dataEmissao < b.dataEmissao ? 1 : -1));
    const anos = state.anosDisponiveis();
    const lista = filtroAno ? todas.filter((n) => utils.yearFromMonthRef(n.mesEmissao) === Number(filtroAno)) : todas;
    const resumoAno = filtroAno ? state.notasFiscaisDoAno(Number(filtroAno)) : { quantidade: lista.length, total: utils.sum(lista, (n) => n.valor) };

    container.innerHTML = `
      <div class="view-header">
        <h1>Notas fiscais</h1>
        <button type="button" class="button button--primary button--icon" data-action="nova-nf">${App.icons.get('plus')} Nova NF</button>
      </div>

      <div class="filter-bar">
        <select class="input" data-field="ano">
          <option value="">Todos os anos</option>
          ${anos.map((a) => `<option value="${a}" ${String(a) === filtroAno ? 'selected' : ''}>${a}</option>`).join('')}
        </select>
      </div>

      <div class="list-summary">${resumoAno.quantidade} nota${resumoAno.quantidade === 1 ? '' : 's'} emitida${resumoAno.quantidade === 1 ? '' : 's'} · Total faturado ${utils.formatCurrency(resumoAno.total)}</div>

      ${lista.length ? `
        <div class="data-list data-list--nfs">
          <div class="data-list__header"><span>Nº da NF</span><span>Mês de emissão</span><span>Data de emissão</span><span>Valor</span><span></span></div>
          ${lista.map((n) => `
            <div class="data-list__row">
              <span>${utils.escapeHtml(n.numero)}</span>
              <span>${utils.escapeHtml(utils.monthRefToLabel(n.mesEmissao))}</span>
              <span>${utils.formatDate(n.dataEmissao)}</span>
              <span class="valor-mono">${utils.formatCurrency(n.valor)}</span>
              <span class="data-list__acoes">
                <button type="button" class="icon-button" title="Editar" data-action="editar" data-id="${n.id}">${App.icons.get('pencil')}</button>
                <button type="button" class="icon-button" title="Excluir" data-action="excluir" data-id="${n.id}">${App.icons.get('trash')}</button>
              </span>
            </div>`).join('')}
        </div>` : '<p class="empty-hint empty-hint--block">Nenhuma nota fiscal cadastrada ainda.</p>'}
    `;

    wireEvents(container);
  }

  function abrirModalNF(nfExistente) {
    const n = nfExistente || { mesEmissao: utils.currentMonthRef(), dataEmissao: utils.todayISO(), numero: '', valor: '' };
    const bodyHtml = `
      <form class="form" data-form="nf">
        <div class="form__row form__row--2">
          <label>Mês de emissão
            <input type="month" name="mesEmissao" required value="${n.mesEmissao}" />
          </label>
          <label>Data de emissão
            <input type="date" name="dataEmissao" required value="${n.dataEmissao}" />
          </label>
        </div>
        <div class="form__row form__row--2">
          <label>Número da NF
            <input type="text" name="numero" required value="${utils.escapeHtml(n.numero)}" />
          </label>
          <label>Valor (R$)
            <input type="number" name="valor" step="0.01" min="0" required value="${n.valor}" />
          </label>
        </div>
        <div class="form__actions">
          <button type="button" class="button button--ghost" data-action="closeModal">Cancelar</button>
          <button type="submit" class="button button--primary">Salvar</button>
        </div>
      </form>`;

    App.modal.open({
      title: nfExistente ? 'Editar nota fiscal' : 'Nova nota fiscal',
      bodyHtml,
      onMount(dialog) {
        const form = dialog.querySelector('form');
        form.onsubmit = (e) => {
          e.preventDefault();
          const fd = new FormData(form);
          const payload = {
            mesEmissao: fd.get('mesEmissao'),
            dataEmissao: fd.get('dataEmissao'),
            numero: String(fd.get('numero') || '').trim(),
            valor: Number(fd.get('valor')) || 0,
          };
          if (nfExistente) {
            state.updateNotaFiscal(nfExistente.id, payload);
            App.toast.show('Nota fiscal atualizada.', 'sucesso');
          } else {
            state.addNotaFiscal(payload);
            App.toast.show('Nota fiscal adicionada.', 'sucesso');
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
      if (action === 'nova-nf') abrirModalNF(null);
      else if (action === 'editar') abrirModalNF(state.getData().notasFiscais.find((n) => n.id === id));
      else if (action === 'excluir') {
        if (window.confirm('Excluir esta nota fiscal?')) {
          state.deleteNotaFiscal(id);
          App.toast.show('Nota fiscal excluída.', 'info');
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
