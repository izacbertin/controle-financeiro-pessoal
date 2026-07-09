/*
 * Painel principal: indicadores do mês selecionado, gráficos e listas de
 * atenção (atrasados / próximos vencimentos). Nada aqui é editável — tudo é
 * calculado a partir dos dados de Gastos e Receitas via App.state.
 */
window.App = window.App || {};
App.views = App.views || {};

App.views.dashboard = (function () {
  const utils = App.utils;
  const state = App.state;

  let prazoProximos = 7; // dias — controlado pelo segmented control da tela

  function statTile(label, value, opts) {
    opts = opts || {};
    const deltaHtml = opts.delta != null
      ? `<div class="stat-tile__delta stat-tile__delta--${opts.deltaSentido || 'neutro'}">${opts.delta}</div>`
      : '';
    return `
      <div class="stat-tile">
        <div class="stat-tile__label">${label}</div>
        <div class="stat-tile__value">${value}</div>
        ${deltaHtml}
      </div>`;
  }

  function render(container) {
    const ui = state.getUI();
    const mes = ui.dashboardMonth;
    const resumo = state.resumoMensal(mes);
    const variacao = state.variacaoMesAnterior(mes);
    const gastosDoMes = state.gastosDoMes(mes);
    const porCategoria = App.charts.foldTop(state.gastosPorCategoria(gastosDoMes), 7);
    const fixoVariavel = state.comparativoFixoVariavel(gastosDoMes);
    const atrasados = state.gastosAtrasados();
    const proximos = state.proximosVencimentos(prazoProximos);
    const evolucao = state.evolucaoMensal(mes, 12);

    const saldoSentido = resumo.saldo >= 0 ? 'positivo' : 'negativo';
    const variacaoTexto = variacao == null ? '—' : `${variacao >= 0 ? '▲' : '▼'} ${Math.abs(variacao).toFixed(1)}% vs mês anterior`;
    const variacaoSentido = variacao == null ? 'neutro' : (variacao > 0 ? 'negativo' : 'positivo');

    container.innerHTML = `
      <div class="view-header">
        <h1>Painel</h1>
        <div class="month-switcher">
          <button type="button" class="icon-button" data-action="mes-anterior" aria-label="Mês anterior">‹</button>
          <input type="month" class="month-input" value="${mes}" data-field="dashboardMonth" />
          <button type="button" class="icon-button" data-action="mes-seguinte" aria-label="Próximo mês">›</button>
        </div>
      </div>

      <section class="stat-grid">
        ${statTile('Saldo do mês', `<span class="valor--${saldoSentido}">${utils.formatCurrency(resumo.saldo)}</span>`)}
        ${statTile('Receita do mês', utils.formatCurrency(resumo.receita))}
        ${statTile('Total gasto', utils.formatCurrency(resumo.totalAposDescontos), {
          delta: `${utils.formatPercent(resumo.percentPago, 0)} pago`, deltaSentido: 'neutro',
        })}
        ${statTile('Pago / Pendente', `${utils.formatCurrency(resumo.totalPago)} <span class="stat-tile__sep">/</span> ${utils.formatCurrency(resumo.totalPendente)}`)}
        ${statTile('Renda comprometida', resumo.percentRendaComprometida == null ? '—' : utils.formatPercent(resumo.percentRendaComprometida, 0))}
        ${statTile('Vs. mês anterior', variacaoTexto === '—' ? '—' : utils.formatPercent(Math.abs(variacao), 1), {
          delta: variacao == null ? null : (variacao > 0 ? '▲ aumentou' : '▼ diminuiu'), deltaSentido: variacaoSentido,
        })}
      </section>

      <section class="card-grid card-grid--2">
        <div class="card">
          <h2>Gastos por categoria</h2>
          <div class="bar-list" data-role="categoria"></div>
        </div>
        <div class="card">
          <h2>Fixo x Variável</h2>
          <div class="bar-list" data-role="fixo-variavel"></div>
        </div>
      </section>

      <section class="card">
        <h2>Evolução mensal — receitas x despesas (12 meses)</h2>
        <div data-role="evolucao"></div>
      </section>

      <section class="card-grid card-grid--2">
        <div class="card">
          <div class="card__header-row">
            <h2>Gastos em atraso</h2>
            <span class="badge badge--critical">${atrasados.length}</span>
          </div>
          ${renderAtrasados(atrasados)}
        </div>
        <div class="card">
          <div class="card__header-row">
            <h2>Próximos vencimentos</h2>
            <div class="segmented" data-role="segmented-prazo">
              ${[7, 15, 30].map((d) => `<button type="button" class="segmented__option ${d === prazoProximos ? 'is-active' : ''}" data-prazo="${d}">${d}d</button>`).join('')}
            </div>
          </div>
          ${renderProximos(proximos)}
        </div>
      </section>
    `;

    // Gastos por categoria (renderizado à parte por usar o componente de barras)
    App.charts.renderBarList(container.querySelector('[data-role="categoria"]'), porCategoria);
    App.charts.renderBarList(container.querySelector('[data-role="fixo-variavel"]'), fixoVariavel);
    App.charts.renderLineChart(container.querySelector('[data-role="evolucao"]'), {
      labels: evolucao.labels,
      series: [
        { key: 'receita', label: 'Receita', values: evolucao.receitas },
        { key: 'despesa', label: 'Despesa', values: evolucao.despesas },
      ],
    });

    wireEvents(container);
  }

  function renderAtrasados(lista) {
    if (!lista.length) return '<p class="empty-hint">Nenhum gasto em atraso. 🎉</p>';
    return `<ul class="attention-list">${lista.map((g) => {
      const dias = Math.abs(utils.daysUntil(g.vencimento));
      return `
        <li class="attention-list__item attention-list__item--critical">
          <div>
            <div class="attention-list__title">${utils.escapeHtml(g.descricao)}</div>
            <div class="attention-list__meta">${utils.escapeHtml(state.categoriaNome(g.categoriaId))} · venceu em ${utils.formatDate(g.vencimento)} (${dias}d)</div>
          </div>
          <div class="attention-list__actions">
            <span class="attention-list__valor">${utils.formatCurrency(state.valorLiquido(g))}</span>
            <button type="button" class="button button--small" data-action="pagar" data-id="${g.id}">Marcar pago</button>
          </div>
        </li>`;
    }).join('')}</ul>`;
  }

  function renderProximos(lista) {
    if (!lista.length) return '<p class="empty-hint">Nada vencendo nesse período.</p>';
    return `<ul class="attention-list">${lista.map((g) => {
      const dias = utils.daysUntil(g.vencimento);
      return `
        <li class="attention-list__item">
          <div>
            <div class="attention-list__title">${utils.escapeHtml(g.descricao)}</div>
            <div class="attention-list__meta">${utils.escapeHtml(state.categoriaNome(g.categoriaId))} · vence em ${utils.formatDate(g.vencimento)} (${dias === 0 ? 'hoje' : `em ${dias}d`})</div>
          </div>
          <div class="attention-list__actions">
            <span class="attention-list__valor">${utils.formatCurrency(state.valorLiquido(g))}</span>
            <button type="button" class="button button--small" data-action="pagar" data-id="${g.id}">Marcar pago</button>
          </div>
        </li>`;
    }).join('')}</ul>`;
  }

  function wireEvents(container) {
    container.onclick = (e) => {
      const btn = e.target.closest('[data-action], [data-prazo]');
      if (!btn) return;
      if (btn.dataset.action === 'mes-anterior') {
        state.setUI({ dashboardMonth: utils.addMonths(state.getUI().dashboardMonth, -1) });
      } else if (btn.dataset.action === 'mes-seguinte') {
        state.setUI({ dashboardMonth: utils.addMonths(state.getUI().dashboardMonth, 1) });
      } else if (btn.dataset.action === 'pagar') {
        state.marcarGastoPago(btn.dataset.id);
        App.toast.show('Gasto marcado como pago.', 'sucesso');
      } else if (btn.dataset.prazo) {
        prazoProximos = Number(btn.dataset.prazo);
        render(container);
      }
    };
    container.onchange = (e) => {
      if (e.target.dataset.field === 'dashboardMonth' && e.target.value) {
        state.setUI({ dashboardMonth: e.target.value });
      }
    };
  }

  return { render };
})();
