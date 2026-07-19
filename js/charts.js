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

  // opts.icons: quando true, mostra um ícone de categoria antes do rótulo
  // (resolvido pelo nome via App.icons.forCategoria). As barras entram com
  // uma animação de "crescimento" da largura logo após o mount.
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
      const iconeHtml = opts.icons
        ? `<span class="bar-row__icon" style="color:${cor};">${App.icons.forCategoria(item.nome)}</span>`
        : '';
      return `
        <div class="bar-row">
          <div class="bar-row__label">${iconeHtml}<span class="bar-row__nome">${utils.escapeHtml(item.nome)}</span></div>
          <div class="bar-row__track">
            <div class="bar-row__fill" style="width:0%; background:${cor};" data-w="${largura}"></div>
          </div>
          <div class="bar-row__value">
            <span class="bar-row__amount">${formatValue(item.valor)}</span>
            <span class="bar-row__percent">${utils.formatPercent(item.percentual, 1)}</span>
          </div>
        </div>`;
    }).join('');

    // Anima as larguras no próximo frame (parte de 0% pra crescer). A
    // transição em si é do CSS (.bar-row__fill { transition: width }).
    requestAnimationFrame(() => {
      container.querySelectorAll('.bar-row__fill').forEach((el) => {
        el.style.width = el.dataset.w + '%';
      });
    });
  }

  // -----------------------------------------------------------------------
  // Gráfico de rosca (donut) — usado no Fixo x Variável, que é sempre
  // part-to-whole de 2 fatias. Cada fatia é um arco desenhado com
  // stroke-dasharray; anima "crescendo" via stroke-dashoffset no mount.
  // segments: [{ label, valor, cor }]  (cor = string CSS, ex.: var(--...))
  // -----------------------------------------------------------------------

  function renderDonut(container, segments, opts) {
    opts = opts || {};
    const total = utils.sum(segments, (s) => s.valor);
    const size = 132;      // viewBox
    const stroke = 18;
    const r = (size - stroke) / 2;
    const cx = size / 2;
    const C = 2 * Math.PI * r;

    if (total <= 0) {
      container.innerHTML = '<p class="empty-hint">Sem dados para o período selecionado.</p>';
      return;
    }

    // Monta os arcos. Cada fatia é desenhada com stroke-dasharray (comprimento
    // do arco + resto vazio) e girada pra começar onde a anterior terminou.
    // A entrada animada é do donut inteiro (fade + escala, no CSS), evitando
    // matemática frágil de dashoffset por fatia.
    let acc = 0;
    const arcos = segments.map((s) => {
      const len = (s.valor / total) * C;
      const rot = (acc / total) * 360 - 90; // começa no topo
      acc += s.valor;
      return `<circle cx="${cx}" cy="${cx}" r="${r}"
        fill="none" stroke="${s.cor}" stroke-width="${stroke}" stroke-linecap="butt"
        transform="rotate(${rot} ${cx} ${cx})"
        stroke-dasharray="${len} ${C - len}" />`;
    }).join('');

    const legenda = segments.map((s) => `
      <div class="donut-legend__item">
        <span class="donut-legend__swatch" style="background:${s.cor};"></span>
        <span class="donut-legend__label">${utils.escapeHtml(s.label)}</span>
        <span class="donut-legend__valor">${utils.formatCurrency(s.valor)}</span>
        <span class="donut-legend__pct">${utils.formatPercent((s.valor / total) * 100, 0)}</span>
      </div>`).join('');

    container.innerHTML = `
      <div class="donut">
        <svg class="donut__svg" viewBox="0 0 ${size} ${size}" role="img" aria-label="Fixo x Variável">
          <circle cx="${cx}" cy="${cx}" r="${r}" fill="none" stroke="var(--track-bg)" stroke-width="${stroke}" />
          ${arcos}
        </svg>
        <div class="donut__center">
          <span class="donut__center-label">Total</span>
          <span class="donut__center-valor">${utils.formatCurrency(total)}</span>
        </div>
      </div>
      <div class="donut-legend">${legenda}</div>`;
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

    // Linhas + ponto final (sem o rótulo — os rótulos são posicionados
    // depois, juntos, pra evitar sobreposição quando as séries terminam com
    // valores próximos).
    const linesSvg = series.map((s) => {
      const d = s.values.map((v, i) => `${i === 0 ? 'M' : 'L'}${xAt(i)},${yAt(v)}`).join(' ');
      const lastIndex = s.values.length - 1;
      const lastX = xAt(lastIndex);
      const lastY = yAt(s.values[lastIndex]);
      return `
        <path class="chart-line" d="${d}" fill="none" stroke="var(--series-${s.key})" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" />
        <circle class="chart-end-dot" cx="${lastX}" cy="${lastY}" r="4" fill="var(--series-${s.key})" stroke="var(--card-bg)" stroke-width="2" />`;
    }).join('');

    // Rótulos do valor final: anti-colisão vertical (empurra pra baixo quando
    // ficam perto), coloridos pela cor da série pra sempre dar pra distinguir
    // qual é qual. Funciona pra 2+ séries e conforme mais meses entram.
    const MIN_GAP = 16;
    const endLabels = series.map((s) => {
      const li = s.values.length - 1;
      return { key: s.key, y: yAt(s.values[li]), text: formatValue(s.values[li]) };
    }).sort((a, b) => a.y - b.y);
    for (let i = 1; i < endLabels.length; i++) {
      if (endLabels[i].y - endLabels[i - 1].y < MIN_GAP) endLabels[i].y = endLabels[i - 1].y + MIN_GAP;
    }
    // Se o empilhamento estourou a base, sobe o grupo todo; depois trava no topo.
    const excesso = endLabels.length ? endLabels[endLabels.length - 1].y - (LINE_H - PAD.bottom - 2) : 0;
    if (excesso > 0) endLabels.forEach((l) => { l.y -= excesso; });
    endLabels.forEach((l) => { if (l.y < PAD.top + 8) l.y = PAD.top + 8; });
    const endLabelsSvg = endLabels.map((l) =>
      `<text x="${LINE_W - PAD.right}" y="${l.y}" class="chart-end-label" fill="var(--series-${l.key})" text-anchor="end" dominant-baseline="middle">${utils.escapeHtml(l.text)}</text>`
    ).join('');

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
          ${endLabelsSvg}
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

    animateLineDraw(container);
    wireLineChartInteraction(container, { labels, series, xAt, xStep, formatValue });
  }

  // Faz cada linha "se desenhar" da esquerda pra direita: usa o comprimento
  // real do traçado como dasharray e anima o dashoffset de 100% -> 0. Os
  // pontos/rótulos da ponta entram com um fade logo depois. Respeita quem
  // pediu menos movimento (prefers-reduced-motion).
  function animateLineDraw(container) {
    const prefereMenosMovimento = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const linhas = container.querySelectorAll('.chart-line');
    const pontas = container.querySelectorAll('.chart-end-dot, .chart-end-label');
    if (prefereMenosMovimento || !linhas.length) return;

    linhas.forEach((linha) => {
      const comprimento = linha.getTotalLength();
      linha.style.transition = 'none';
      linha.style.strokeDasharray = comprimento;
      linha.style.strokeDashoffset = comprimento;
    });
    pontas.forEach((p) => { p.style.transition = 'none'; p.style.opacity = '0'; });

    requestAnimationFrame(() => {
      linhas.forEach((linha) => {
        linha.style.transition = 'stroke-dashoffset 900ms cubic-bezier(0.4, 0, 0.2, 1)';
        linha.style.strokeDashoffset = '0';
      });
      pontas.forEach((p) => {
        p.style.transition = 'opacity 400ms ease 600ms';
        p.style.opacity = '1';
      });
    });
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

  return { foldTop, renderBarList, renderLineChart, renderDonut };
})();
