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
    const iconHtml = opts.icon
      ? `<span class="stat-tile__icon stat-tile__icon--${opts.iconTone || 'neutro'}">${App.icons.get(opts.icon)}</span>`
      : '';
    return `
      <div class="stat-tile">
        ${iconHtml}
        <div class="stat-tile__label">${label}</div>
        <div class="stat-tile__value">${value}</div>
        ${deltaHtml}
      </div>`;
  }

  // Como statTile(), mas o valor é um placeholder que App.animate anima do
  // último número mostrado até o novo (efeito "contador") depois do mount.
  function statTileCountUp(label, countUp, opts) {
    const span = `<span class="${countUp.wrapClass || ''}" data-countup="${countUp.chave}" data-value="${countUp.valor}" data-fmt="${countUp.fmt || 'currency'}"></span>`;
    return statTile(label, span, opts);
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
      <div class="dashboard-hero-glow" aria-hidden="true"></div>
      <div class="view-header">
        <h1>Painel</h1>
        <div class="month-switcher">
          <button type="button" class="icon-button" data-action="mes-anterior" aria-label="Mês anterior">${App.icons.get('chevron-left')}</button>
          <input type="month" class="month-input" value="${mes}" data-field="dashboardMonth" />
          <button type="button" class="icon-button" data-action="mes-seguinte" aria-label="Próximo mês">${App.icons.get('chevron-right')}</button>
        </div>
      </div>

      <section class="stat-grid">
        ${statTileCountUp('Saldo do mês', { chave: 'dashboard:saldo', valor: resumo.saldo, wrapClass: `valor--${saldoSentido}` }, { icon: 'wallet', iconTone: saldoSentido === 'positivo' ? 'good' : 'critical' })}
        ${statTileCountUp('Receita do mês', { chave: 'dashboard:receita', valor: resumo.receita }, { icon: 'trending-up', iconTone: 'good' })}
        ${statTileCountUp('Total gasto', { chave: 'dashboard:totalGasto', valor: resumo.totalAposDescontos }, {
          delta: `${utils.formatPercent(resumo.percentPago, 0)} pago`, deltaSentido: 'neutro', icon: 'trending-down', iconTone: 'accent',
        })}
        ${statTile('Pago / Pendente', `<span data-countup="dashboard:pago" data-value="${resumo.totalPago}"></span> <span class="stat-tile__sep">/</span> <span data-countup="dashboard:pendente" data-value="${resumo.totalPendente}"></span>`, { icon: 'check-circle', iconTone: 'good' })}
        ${resumo.percentRendaComprometida == null
          ? statTile('Renda comprometida', '—', { icon: 'gauge', iconTone: 'accent' })
          : statTileCountUp('Renda comprometida', { chave: 'dashboard:rendaComprometida', valor: resumo.percentRendaComprometida, fmt: 'percent' }, { icon: 'gauge', iconTone: 'accent' })}
        ${statTile('Vs. mês anterior', variacaoTexto === '—' ? '—' : utils.formatPercent(Math.abs(variacao), 1), {
          delta: variacao == null ? null : (variacao > 0 ? '▲ aumentou' : '▼ diminuiu'), deltaSentido: variacaoSentido, icon: 'activity', iconTone: 'neutro',
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
            <h2><span class="h2-icon h2-icon--critical">${App.icons.get('alert-triangle')}</span> Gastos em atraso</h2>
            <span class="badge badge--critical">${atrasados.length}</span>
          </div>
          ${renderAtrasados(atrasados)}
        </div>
        <div class="card">
          <div class="card__header-row">
            <h2><span class="h2-icon h2-icon--accent">${App.icons.get('calendar')}</span> Próximos vencimentos</h2>
            <div class="segmented" data-role="segmented-prazo">
              ${[7, 15, 30].map((d) => `<button type="button" class="segmented__option ${d === prazoProximos ? 'is-active' : ''}" data-prazo="${d}">${d}d</button>`).join('')}
            </div>
          </div>
          ${renderProximos(proximos)}
        </div>
      </section>
    `;

    // Gastos por categoria (renderizado à parte por usar o componente de barras)
    App.charts.renderBarList(container.querySelector('[data-role="categoria"]'), porCategoria, { icons: true });
    App.charts.renderBarList(container.querySelector('[data-role="fixo-variavel"]'), fixoVariavel);
    App.charts.renderLineChart(container.querySelector('[data-role="evolucao"]'), {
      labels: evolucao.labels,
      series: [
        { key: 'receita', label: 'Receita', values: evolucao.receitas },
        { key: 'despesa', label: 'Despesa', values: evolucao.despesas },
      ],
    });

    App.animate.wireCountUps(container);
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
            <button type="button" class="button button--small button--icon" data-action="pagar" data-id="${g.id}">${App.icons.get('check')} Marcar pago</button>
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
            <button type="button" class="button button--small button--icon" data-action="pagar" data-id="${g.id}">${App.icons.get('check')} Marcar pago</button>
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
