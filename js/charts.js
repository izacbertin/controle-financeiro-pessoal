/*
 * Gráficos "artesanais" (sem biblioteca externa), seguindo a metodologia do
 * skill de dataviz: cor categórica só onde há identidade real, no máximo ~7
 * séries individuais + um balde "Outras", eixo único, marcas finas, rótulos
 * diretos seletivos, e um "gêmeo em tabela" para cada gráfico (acessibilidade
 * e para quem prefere números a barras).
 *
 * Barras horizontais são usadas para "categoria" e "fixo x variável" — um
 * rosca/pizza foi evitado de propósito (a metodologia desaconselha pizza para
 * comparar valores próximos ou mais de ~6 fatias; barra + valor direto lê
 * melhor e escala para o número de categorias que o usuário cadastrar).
 */
window.App = window.App || {};

App.charts = (function () {
  const utils = App.utils;
  const compactCurrency = new Intl.NumberFormat('pt-BR', {
    style: 'currency', currency: 'BRL', notation: 'compact', maximumFractionDigits: 1,
  });

  // -----------------------------------------------------------------------
  // Barras horizontais (categorias, fixo x variável, top categorias)
  // -----------------------------------------------------------------------

  // Agrupa itens além do limite em um único item "Outras" — nunca gera uma
  // 9ª cor: no máximo `limite` cores categóricas + 1 cinza neutro.
  function foldTop(items, limite) {
    if (items.length <= limite) return items;
    const topo = items.slice(0, limite);
    const resto = items.slice(limite);
    topo.push({
      categoriaId: '__outras__',
      nome: 'Outras',
      valor: utils.sum(resto, (i) => i.valor),
      percentual: utils.sum(resto, (i) => i.percentual),
    });
    return topo;
  }

  function renderBarList(container, items, opts) {
    opts = opts || {};
    const formatValue = opts.formatValue || utils.formatCurrency;
    if (!items.length) {
      container.innerHTML = '<p class="empty-hint">Sem dados para o período selecionado.</p>';
      return;
    }
    const max = Math.max(1, ...items.map((i) => i.valor));
    container.innerHTML = items.map((item, index) => {
      const largura = utils.clamp((item.valor / max) * 100, item.valor > 0 ? 2 : 0, 100);
      const cor = item.nome === 'Outras' ? 'var(--chart-outras)' : `var(--chart-cat-${(index % 7) + 1})`;
      return `
        <div class="bar-row">
          <div class="bar-row__label">${utils.escapeHtml(item.nome)}</div>
          <div class="bar-row__track">
            <div class="bar-row__fill" style="width:${largura}%; background:${cor};"></div>
          </div>
          <div class="bar-row__value">
            <span class="bar-row__amount">${formatValue(item.valor)}</span>
            <span class="bar-row__percent">${utils.formatPercent(item.percentual, 1)}</span>
          </div>
        </div>`;
    }).join('');
  }

  // -----------------------------------------------------------------------
  // Gráfico de linha (evolução mensal receitas x despesas)
  // -----------------------------------------------------------------------

  const LINE_W = 720;
  const LINE_H = 300;
  const PAD = { left: 64, right: 20, top: 20, bottom: 40 };

  function niceCeil(value) {
    if (value <= 0) return 100;
    const exp = Math.floor(Math.log10(value));
    const base = Math.pow(10, exp);
    const steps = [1, 2, 2.5, 5, 10];
    for (const step of steps) {
      if (value <= step * base) return step * base;
    }
    return 10 * base;
  }

  // series: [{ key, label, values:[...] }] — cor vem de var(--series-<key>)
  function renderLineChart(container, { labels, series, formatValue }) {
    formatValue = formatValue || utils.formatCurrency;
    const allValues = series.flatMap((s) => s.values);
    const niceMax = niceCeil(Math.max(1, ...allValues));
    const plotW = LINE_W - PAD.left - PAD.right;
    const plotH = LINE_H - PAD.top - PAD.bottom;
    const xStep = labels.length > 1 ? plotW / (labels.length - 1) : 0;
    const xAt = (i) => PAD.left + i * xStep;
    const yAt = (v) => PAD.top + plotH - (v / niceMax) * plotH;

    const stepsY = 4;
    const gridLines = Array.from({ length: stepsY + 1 }, (_, i) => (niceMax / stepsY) * i);
    const gridSvg = gridLines.map((v) => {
      const y = yAt(v);
      return `
        <line x1="${PAD.left}" y1="${y}" x2="${LINE_W - PAD.right}" y2="${y}" class="chart-grid" />
        <text x="${PAD.left - 10}" y="${y + 4}" class="chart-axis-label" text-anchor="end">${utils.escapeHtml(compactCurrency.format(v))}</text>`;
    }).join('');

    // Mostra todos os rótulos do eixo X se couberem, senão pula de 2 em 2
    // (sempre mantendo o primeiro e o último).
    const showEvery = labels.length > 8 ? 2 : 1;
    const xLabelsSvg = labels.map((m, i) => {
      const isLast = i === labels.length - 1;
      if (i % showEvery !== 0 && !isLast) return '';
      return `<text x="${xAt(i)}" y="${LINE_H - PAD.bottom + 22}" class="chart-axis-label" text-anchor="middle">${utils.escapeHtml(utils.monthRefToShortLabel(m))}</text>`;
    }).join('');

    const linesSvg = series.map((s) => {
      const d = s.values.map((v, i) => `${i === 0 ? 'M' : 'L'}${xAt(i)},${yAt(v)}`).join(' ');
      const lastIndex = s.values.length - 1;
      const lastX = xAt(lastIndex);
      const lastY = yAt(s.values[lastIndex]);
      return `
        <path d="${d}" fill="none" stroke="var(--series-${s.key})" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" />
        <circle cx="${lastX}" cy="${lastY}" r="4" fill="var(--series-${s.key})" stroke="var(--card-bg)" stroke-width="2" />
        <text x="${utils.clamp(lastX, PAD.left, LINE_W - PAD.right - 40)}" y="${utils.clamp(lastY - 10, PAD.top + 10, LINE_H - PAD.bottom - 4)}" class="chart-end-label" text-anchor="end">${utils.escapeHtml(formatValue(s.values[lastIndex]))}</text>`;
    }).join('');

    const legendHtml = series.map((s) => `
      <span class="chart-legend__item">
        <span class="chart-legend__swatch" style="background:var(--series-${s.key});"></span>
        ${utils.escapeHtml(s.label)}
      </span>`).join('');

    const tableRows = labels.map((m, i) => `
      <tr>
        <td>${utils.escapeHtml(utils.monthRefToLabel(m))}</td>
        ${series.map((s) => `<td>${formatValue(s.values[i])}</td>`).join('')}
      </tr>`).join('');

    container.innerHTML = `
      <div class="chart-legend">${legendHtml}</div>
      <div class="chart-svg-wrap">
        <svg viewBox="0 0 ${LINE_W} ${LINE_H}" class="chart-svg" role="img" aria-label="Evolução mensal">
          ${gridSvg}
          ${xLabelsSvg}
          ${linesSvg}
          <rect class="chart-hover-layer" x="${PAD.left}" y="${PAD.top}" width="${plotW}" height="${plotH}" fill="transparent" />
          <line class="chart-crosshair" x1="0" y1="${PAD.top}" x2="0" y2="${LINE_H - PAD.bottom}" style="opacity:0" />
        </svg>
        <div class="chart-tooltip" style="opacity:0"></div>
      </div>
      <details class="chart-table-toggle">
        <summary>Ver como tabela</summary>
        <div class="table-scroll">
          <table class="data-table">
            <thead><tr><th>Mês</th>${series.map((s) => `<th>${utils.escapeHtml(s.label)}</th>`).join('')}</tr></thead>
            <tbody>${tableRows}</tbody>
          </table>
        </div>
      </details>`;

    wireLineChartInteraction(container, { labels, series, xAt, xStep, formatValue });
  }

  function wireLineChartInteraction(container, { labels, series, xAt, xStep, formatValue }) {
    const svg = container.querySelector('.chart-svg');
    const hoverLayer = container.querySelector('.chart-hover-layer');
    const crosshair = container.querySelector('.chart-crosshair');
    const tooltip = container.querySelector('.chart-tooltip');
    const wrap = container.querySelector('.chart-svg-wrap');
    if (!hoverLayer) return;

    function indexFromClientX(clientX) {
      const rect = svg.getBoundingClientRect();
      const scale = LINE_W / rect.width;
      const svgX = (clientX - rect.left) * scale;
      const rawIndex = xStep > 0 ? (svgX - PAD.left) / xStep : 0;
      return utils.clamp(Math.round(rawIndex), 0, labels.length - 1);
    }

    function showAt(index) {
      const x = xAt(index);
      crosshair.setAttribute('x1', x);
      crosshair.setAttribute('x2', x);
      crosshair.style.opacity = '1';

      const linhas = series.map((s) => `
        <div class="chart-tooltip__row">
          <span class="chart-tooltip__key" style="background:var(--series-${s.key});"></span>
          <span class="chart-tooltip__label">${utils.escapeHtml(s.label)}</span>
          <span class="chart-tooltip__value">${utils.escapeHtml(formatValue(s.values[index]))}</span>
        </div>`).join('');
      tooltip.innerHTML = `<div class="chart-tooltip__month">${utils.escapeHtml(utils.monthRefToLabel(labels[index]))}</div>${linhas}`;
      tooltip.style.opacity = '1';

      const rect = svg.getBoundingClientRect();
      const scale = rect.width / LINE_W;
      const pixelX = x * scale;
      const tooltipWidth = tooltip.offsetWidth || 160;
      const maxLeft = wrap.clientWidth - tooltipWidth - 8;
      tooltip.style.left = `${utils.clamp(pixelX + 12, 8, Math.max(8, maxLeft))}px`;
      tooltip.style.top = '8px';
    }

    function hide() {
      crosshair.style.opacity = '0';
      tooltip.style.opacity = '0';
    }

    hoverLayer.addEventListener('pointermove', (e) => showAt(indexFromClientX(e.clientX)));
    hoverLayer.addEventListener('pointerdown', (e) => showAt(indexFromClientX(e.clientX)));
    hoverLayer.addEventListener('pointerleave', hide);
  }

  return { foldTop, renderBarList, renderLineChart };
})();
