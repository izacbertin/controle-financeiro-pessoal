/*
 * Consolidado: tela 100% calculada (nada é editável aqui) a partir de Gastos
 * e Receitas — visão mensal e visão anual, com seletor de mês/ano.
 * "Total após descontos" assume um campo opcional de desconto por gasto
 * (ex.: abatimento negociado numa conta) — ver campo "Desconto" no formulário
 * de Gastos.
 */
window.App = window.App || {};
App.views = App.views || {};

App.views.consolidado = (function () {
  const utils = App.utils;
  const state = App.state;

  function render(container) {
    const ui = state.getUI();
    container.innerHTML = `
      <div class="view-header">
        <h1>Consolidado</h1>
        <div class="segmented" data-role="segmented-modo">
          <button type="button" class="segmented__option ${ui.consolidadoModo === 'mensal' ? 'is-active' : ''}" data-modo="mensal">Mensal</button>
          <button type="button" class="segmented__option ${ui.consolidadoModo === 'anual' ? 'is-active' : ''}" data-modo="anual">Anual</button>
        </div>
      </div>
      <div data-role="conteudo"></div>
    `;

    const conteudo = container.querySelector('[data-role="conteudo"]');
    if (ui.consolidadoModo === 'mensal') renderMensal(conteudo);
    else renderAnual(conteudo);

    wireEvents(container);
  }

  function renderMensal(container) {
    const ui = state.getUI();
    const r = state.resumoMensal(ui.consolidadoMonth);
    container.innerHTML = `
      <div class="month-switcher month-switcher--standalone">
        <button type="button" class="icon-button" data-action="mes-anterior" aria-label="Mês anterior">‹</button>
        <input type="month" class="month-input" value="${ui.consolidadoMonth}" data-field="consolidadoMonth" />
        <button type="button" class="icon-button" data-action="mes-seguinte" aria-label="Próximo mês">›</button>
      </div>

      <div class="stat-grid">
        <div class="stat-tile"><div class="stat-tile__label">Receita</div><div class="stat-tile__value">${utils.formatCurrency(r.receita)}</div></div>
        <div class="stat-tile"><div class="stat-tile__label">Despesas totais</div><div class="stat-tile__value">${utils.formatCurrency(r.despesasTotais)}</div></div>
        <div class="stat-tile"><div class="stat-tile__label">Total após descontos</div><div class="stat-tile__value">${utils.formatCurrency(r.totalAposDescontos)}</div></div>
        <div class="stat-tile"><div class="stat-tile__label">Total pago</div><div class="stat-tile__value">${utils.formatCurrency(r.totalPago)}</div></div>
        <div class="stat-tile"><div class="stat-tile__label">% pago</div><div class="stat-tile__value">${utils.formatPercent(r.percentPago, 0)}</div></div>
        <div class="stat-tile"><div class="stat-tile__label">Saldo</div><div class="stat-tile__value"><span class="valor--${r.saldo >= 0 ? 'positivo' : 'negativo'}">${utils.formatCurrency(r.saldo)}</span></div></div>
      </div>
    `;
  }

  function renderAnual(container) {
    const ui = state.getUI();
    const ano = ui.consolidadoYear;
    const r = state.resumoAnual(ano);
    const nfs = state.notasFiscaisDoAno(ano);
    const anos = state.anosDisponiveis();
    const meses = Array.from({ length: 12 }, (_, i) => `${ano}-${utils.pad(i + 1)}`);

    container.innerHTML = `
      <div class="filter-bar">
        <select class="input" data-field="consolidadoYear">
          ${anos.map((a) => `<option value="${a}" ${a === ano ? 'selected' : ''}>${a}</option>`).join('')}
        </select>
      </div>

      <div class="stat-grid">
        <div class="stat-tile"><div class="stat-tile__label">Receita anual</div><div class="stat-tile__value">${utils.formatCurrency(r.receitaAnual)}</div></div>
        <div class="stat-tile"><div class="stat-tile__label">Despesa anual</div><div class="stat-tile__value">${utils.formatCurrency(r.despesaAnual)}</div></div>
        <div class="stat-tile"><div class="stat-tile__label">% da renda comprometida</div><div class="stat-tile__value">${r.percentRendaComprometida == null ? '—' : utils.formatPercent(r.percentRendaComprometida, 0)}</div></div>
        <div class="stat-tile"><div class="stat-tile__label">% pago no ano</div><div class="stat-tile__value">${utils.formatPercent(r.percentPago, 0)}</div></div>
        <div class="stat-tile"><div class="stat-tile__label">NFs emitidas</div><div class="stat-tile__value">${nfs.quantidade}</div></div>
        <div class="stat-tile"><div class="stat-tile__label">Total faturado</div><div class="stat-tile__value">${utils.formatCurrency(nfs.total)}</div></div>
      </div>

      <div class="card">
        <h2>Detalhe por mês</h2>
        <div class="table-scroll">
          <table class="data-table">
            <thead><tr><th>Mês</th><th>Receita</th><th>Despesa</th><th>Saldo</th><th>% pago</th></tr></thead>
            <tbody>
              ${meses.map((m) => {
                const rm = state.resumoMensal(m);
                return `<tr>
                  <td>${utils.escapeHtml(utils.monthRefToLabel(m))}</td>
                  <td>${utils.formatCurrency(rm.receita)}</td>
                  <td>${utils.formatCurrency(rm.totalAposDescontos)}</td>
                  <td><span class="valor--${rm.saldo >= 0 ? 'positivo' : 'negativo'}">${utils.formatCurrency(rm.saldo)}</span></td>
                  <td>${utils.formatPercent(rm.percentPago, 0)}</td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  function wireEvents(container) {
    container.onclick = (e) => {
      const modoBtn = e.target.closest('[data-modo]');
      if (modoBtn) { state.setUI({ consolidadoModo: modoBtn.dataset.modo }); return; }

      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      const ui = state.getUI();
      if (btn.dataset.action === 'mes-anterior') state.setUI({ consolidadoMonth: utils.addMonths(ui.consolidadoMonth, -1) });
      else if (btn.dataset.action === 'mes-seguinte') state.setUI({ consolidadoMonth: utils.addMonths(ui.consolidadoMonth, 1) });
    };
    container.onchange = (e) => {
      if (e.target.dataset.field === 'consolidadoMonth' && e.target.value) state.setUI({ consolidadoMonth: e.target.value });
      else if (e.target.dataset.field === 'consolidadoYear') state.setUI({ consolidadoYear: Number(e.target.value) });
    };
  }

  return { render };
})();
