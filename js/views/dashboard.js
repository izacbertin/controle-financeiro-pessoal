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
    // O ícone fica numa linha de topo AO LADO do rótulo (não mais sobreposto),
    // então valores grandes usam a largura toda do card sem colidir com ele.
    // opts.key gera uma classe (ex.: stat-tile--receita) que temas usam pra
    // enfeitar cards específicos (ex.: personagens do tema Star Wars).
    const keyClass = opts.key ? ` stat-tile--${opts.key}` : '';
    return `
      <div class="stat-tile${keyClass}">
        <div class="stat-tile__top">
          <div class="stat-tile__label">${label}</div>
          ${iconHtml}
        </div>
        <div class="stat-tile__value">${value}</div>
        ${deltaHtml}
        ${opts.footer || ''}
      </div>`;
  }

  // Barra de progresso do % pago. O preenchimento é um gradiente fixo
  // vermelho -> amarelo -> verde (então quanto mais cheia, mais "verde" fica
  // exposto), com um brilho que corre por dentro. A largura parte de 0 e
  // cresce até o valor no mount (a transição fica no CSS).
  function progressoPago(percent) {
    const pct = utils.clamp(Math.round(percent || 0), 0, 100);
    return `
      <div class="progress" title="${pct}% das contas do mês pagas">
        <div class="progress__track">
          <div class="progress__fill" style="width:0%;" data-w="${pct}">
            <span class="progress__shine"></span>
          </div>
        </div>
        <div class="progress__caption">${pct}% pago</div>
      </div>`;
  }

  // Lista as categorias que têm orçamento definido, com barra gasto/limite.
  // Cor: ok < 80% < atenção < 100% < estourou.
  function renderOrcamentos(status) {
    if (!status.length) {
      return '<p class="empty-hint empty-hint--block">Nenhum teto de gasto definido. Clique em <strong>Definir</strong> para criar orçamentos por categoria e acompanhar quanto já usou.</p>';
    }
    return `<div class="orc-list">${status.map((o) => {
      const pct = utils.clamp(o.percent, 0, 100);
      const nivel = o.estourou ? 'critico' : o.percent >= 80 ? 'atencao' : 'ok';
      return `
        <div class="orc-row">
          <div class="orc-row__top">
            <span class="orc-row__nome"><span class="cat-icon" style="color:var(--chart-cat-1);">${App.icons.forCategoria(o.nome)}</span>${utils.escapeHtml(o.nome)}</span>
            <span class="orc-row__valores">${utils.formatCurrency(o.gasto)} <span class="orc-row__limite">/ ${utils.formatCurrency(o.limite)}</span></span>
          </div>
          <div class="orc-bar">
            <div class="orc-bar__fill orc-bar__fill--${nivel}" style="width:0%;" data-w="${pct}"></div>
          </div>
        </div>`;
    }).join('')}</div>`;
  }

  function abrirModalOrcamentos() {
    const categorias = state.listCategorias();
    const orcs = state.getOrcamentos();
    const linhas = categorias.map((c) => `
      <label class="orc-form__row">
        <span class="orc-form__nome"><span class="cat-icon">${App.icons.forCategoria(c.nome)}</span>${utils.escapeHtml(c.nome)}</span>
        <input type="number" step="0.01" min="0" name="orc:${c.id}" placeholder="0,00" value="${orcs[c.id] != null ? orcs[c.id] : ''}" />
      </label>`).join('');
    App.modal.open({
      title: 'Definir orçamentos',
      size: 'lg',
      bodyHtml: `
        <form class="form" data-form="orcamentos">
          <p class="info-banner">Defina um teto de gasto mensal por categoria. Deixe em branco (ou 0) para não acompanhar aquela categoria.</p>
          <div class="orc-form">${linhas}</div>
          <div class="form__actions">
            <button type="button" class="button button--ghost" data-action="closeModal">Cancelar</button>
            <button type="submit" class="button button--primary">Salvar</button>
          </div>
        </form>`,
      onMount(dialog) {
        const form = dialog.querySelector('form');
        form.onsubmit = (e) => {
          e.preventDefault();
          const mapa = {};
          categorias.forEach((c) => {
            const el = form.elements[`orc:${c.id}`];
            if (el) mapa[c.id] = el.value;
          });
          state.setOrcamentosEmLote(mapa);
          App.toast.show('Orçamentos atualizados.', 'sucesso');
          App.modal.close();
        };
      },
    });
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

    // Saldo que veio de meses anteriores (sobra ou estouro). Quando existe,
    // ele é somado à receita efetiva do mês e mostramos a observação.
    const temSaldoAnterior = Math.abs(resumo.saldoAnterior) >= 0.005;
    const saldoAnteriorNota = temSaldoAnterior
      ? `${resumo.saldoAnterior >= 0 ? '+' : '−'}${utils.formatCurrency(Math.abs(resumo.saldoAnterior))} de meses anteriores`
      : '';
    const receitaFooter = temSaldoAnterior
      ? `<div class="stat-tile__note">${utils.formatCurrency(resumo.receita)} lançada · <span class="stat-tile__note--${resumo.saldoAnterior >= 0 ? 'good' : 'critical'}">${saldoAnteriorNota}</span></div>`
      : '';

    // Indicadores novos: sobra só do mês, e despesa vs média dos 3 meses anteriores.
    const sobraSentido = resumo.saldoDoMes >= 0 ? 'positivo' : 'negativo';
    const media3 = state.mediaDespesasMesesAnteriores(mes, 3);
    const vsMediaPct = (media3 && media3 > 0) ? ((resumo.totalAposDescontos - media3) / media3) * 100 : null;
    const vsMediaSentido = vsMediaPct == null ? 'neutro' : (vsMediaPct > 0 ? 'negativo' : 'positivo');
    const insights = state.gerarInsights(mes);

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

      <section class="dashboard-hero">
        <div class="dashboard-hero__label"><span class="hero-label--default">Saldo do mês</span><span class="hero-label--sw">Painel de Comando</span> · ${utils.escapeHtml(utils.monthRefToLabel(mes))}</div>
        <div class="dashboard-hero__value valor--${saldoSentido}"><span data-countup="dashboard:saldo" data-value="${resumo.saldo}"></span></div>
        <div class="dashboard-hero__sub">Receita ${utils.formatCurrency(resumo.receitaComSaldo)} · Gasto ${utils.formatCurrency(resumo.totalAposDescontos)}${temSaldoAnterior ? ` · <span class="dashboard-hero__carry">${saldoAnteriorNota}</span>` : ''}</div>
      </section>

      <section class="stat-grid">
        ${statTileCountUp('Receita do mês', { chave: 'dashboard:receita', valor: resumo.receitaComSaldo }, { icon: 'trending-up', iconTone: 'good', footer: receitaFooter, key: 'receita' })}
        ${statTileCountUp('Total gasto', { chave: 'dashboard:totalGasto', valor: resumo.totalAposDescontos }, {
          delta: `${utils.formatPercent(resumo.percentPago, 0)} pago`, deltaSentido: 'neutro', icon: 'trending-down', iconTone: 'accent', key: 'gasto',
        })}
        ${statTile('Pago / Pendente', `<span data-countup="dashboard:pago" data-value="${resumo.totalPago}"></span> <span class="stat-tile__sep">/</span> <span data-countup="dashboard:pendente" data-value="${resumo.totalPendente}"></span>`, {
          icon: 'check-circle', iconTone: 'good', footer: progressoPago(resumo.percentPago),
        })}
        ${statTileCountUp('Sobra do mês', { chave: 'dashboard:sobra', valor: resumo.saldoDoMes, wrapClass: `valor--${sobraSentido}` }, {
          icon: 'wallet', iconTone: sobraSentido === 'positivo' ? 'good' : 'critical',
          footer: '<div class="stat-tile__note">só deste mês, sem contar meses anteriores</div>',
        })}
        ${resumo.taxaPoupanca == null
          ? statTile('Taxa de poupança', '—', { icon: 'trending-up', iconTone: 'good' })
          : statTileCountUp('Taxa de poupança', { chave: 'dashboard:poupanca', valor: resumo.taxaPoupanca, fmt: 'percent', wrapClass: `valor--${resumo.taxaPoupanca >= 0 ? 'positivo' : 'negativo'}` }, { icon: 'trending-up', iconTone: 'good' })}
        ${resumo.percentRendaComprometida == null
          ? statTile('Renda comprometida', '—', { icon: 'gauge', iconTone: 'accent' })
          : statTileCountUp('Renda comprometida', { chave: 'dashboard:rendaComprometida', valor: resumo.percentRendaComprometida, fmt: 'percent' }, { icon: 'gauge', iconTone: 'accent' })}
        ${statTile('Vs. média 3 meses', vsMediaPct == null ? '—' : utils.formatPercent(Math.abs(vsMediaPct), 0), {
          delta: vsMediaPct == null ? null : (vsMediaPct > 0 ? '▲ acima da média' : '▼ abaixo da média'), deltaSentido: vsMediaSentido, icon: 'activity', iconTone: 'neutro',
          footer: media3 == null ? '' : `<div class="stat-tile__note">média: ${utils.formatCurrency(media3)}</div>`,
        })}
      </section>

      ${insights.length ? `
      <section class="card">
        <h2><span class="h2-icon h2-icon--accent">${App.icons.get('sparkles')}</span> Insights</h2>
        <ul class="insights">
          ${insights.map((it) => `
            <li class="insight insight--${it.tom}">
              <span class="insight__icon">${App.icons.get(it.tom === 'good' ? 'thumbs-up' : it.tom === 'warning' ? 'alert-triangle' : 'info')}</span>
              <span class="insight__texto">${utils.escapeHtml(it.texto)}</span>
            </li>`).join('')}
        </ul>
      </section>` : ''}

      <section class="card">
        <div class="card__header-row">
          <h2><span class="h2-icon h2-icon--accent">${App.icons.get('gauge')}</span> Orçamento do mês</h2>
          <button type="button" class="button button--ghost button--small button--icon" data-action="definir-orcamento">${App.icons.get('pencil')} Definir</button>
        </div>
        ${renderOrcamentos(state.orcamentoStatusDoMes(mes))}
      </section>

      <section class="card-grid card-grid--split">
        <div class="card">
          <h2>Gastos por categoria</h2>
          <div class="bar-list" data-role="categoria"></div>
        </div>
        <div class="card">
          <h2>Fixo x Variável</h2>
          <div class="donut-wrap" data-role="fixo-variavel"></div>
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
    // Fixo x Variável: donut compacto (sempre 2 fatias, part-to-whole).
    App.charts.renderDonut(container.querySelector('[data-role="fixo-variavel"]'), [
      { label: 'Fixo', valor: fixoVariavel[0].valor, cor: 'var(--chart-cat-1)' },
      { label: 'Variável', valor: fixoVariavel[1].valor, cor: 'var(--chart-cat-3)' },
    ]);
    App.charts.renderLineChart(container.querySelector('[data-role="evolucao"]'), {
      labels: evolucao.labels,
      series: [
        { key: 'receita', label: 'Receita', values: evolucao.receitas },
        { key: 'despesa', label: 'Despesa', values: evolucao.despesas },
      ],
    });

    // Anima a(s) barra(s) de progresso: parte de 0% e cresce até o valor
    // (a transição em si é do CSS). Sem isso a barra ficaria sempre vazia.
    // Ancoramos o gradiente na LARGURA DO TRILHO (não no preenchimento), assim
    // o vermelho fica sempre no começo e o verde no fim, independente da
    // largura do card — e a barra apenas "revela" o gradiente até o % pago.
    requestAnimationFrame(() => {
      container.querySelectorAll('.progress__fill').forEach((el) => {
        const trilho = el.parentElement;
        if (trilho) el.style.backgroundSize = `${trilho.clientWidth}px 100%`;
        el.style.width = el.dataset.w + '%';
      });
      // Barras de orçamento por categoria (0% -> valor).
      container.querySelectorAll('.orc-bar__fill').forEach((el) => {
        el.style.width = el.dataset.w + '%';
      });
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
      } else if (btn.dataset.action === 'definir-orcamento') {
        abrirModalOrcamentos();
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
