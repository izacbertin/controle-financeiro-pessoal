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
  let ordenacao = { coluna: 'dataEmissao', dir: 'desc' };

  function th(coluna, rotulo) {
    const ativo = ordenacao.coluna === coluna;
    const seta = ativo ? (ordenacao.dir === 'asc' ? ' ▲' : ' ▼') : '';
    return `<span class="th ${ativo ? 'is-sorted' : ''}" data-sort="${coluna}">${rotulo}${seta}</span>`;
  }

  function ordenar(lista) {
    const mult = ordenacao.dir === 'asc' ? 1 : -1;
    const val = (n) => {
      switch (ordenacao.coluna) {
        case 'numero': { const x = Number(n.numero); return isNaN(x) ? (n.numero || '').toLowerCase() : x; }
        case 'mesEmissao': return n.mesEmissao || '';
        case 'valor': return n.valor || 0;
        case 'dataEmissao':
        default: return n.dataEmissao || '';
      }
    };
    return lista.slice().sort((a, b) => {
      const va = val(a); const vb = val(b);
      if (va < vb) return -1 * mult;
      if (va > vb) return 1 * mult;
      return 0;
    });
  }

  // Card de acompanhamento do limite anual do MEI. O limite vem da config do
  // usuário (limiteMeiDoAno) — pode ser MEI comum, caminhoneiro ou custom, e
  // é proporcional no ano de abertura do CNPJ. Cor da barra: ok (verde) < 70%
  // < atenção (amarelo) < 90% < crítico (vermelho) — "estourou" se passar.
  function renderMei(ano) {
    const faturado = state.notasFiscaisDoAno(ano).total;
    const info = state.limiteMeiDoAno(ano);
    const limite = info.limite;
    const percent = limite > 0 ? (faturado / limite) * 100 : 0;
    const restante = limite - faturado;
    const nivel = percent >= 90 ? 'critico' : percent >= 70 ? 'atencao' : 'ok';
    const larguraBarra = utils.clamp(percent, 0, 100);
    const alerta = percent >= 100
      ? `⚠️ Você ultrapassou o limite do MEI em ${utils.formatCurrency(faturado - limite)}.`
      : percent >= 90
        ? `⚠️ Falta pouco: restam ${utils.formatCurrency(restante)} do limite.`
        : `Restam ${utils.formatCurrency(restante)} do limite deste ano.`;
    const notaProporcional = info.proporcional
      ? `<div class="mei-card__prorata">Limite proporcional: CNPJ aberto em ${utils.escapeHtml(utils.monthRefToShortLabel(state.getMeiConfig().abertura))} → ${info.meses} ${info.meses === 1 ? 'mês' : 'meses'} no ano.</div>`
      : '';
    return `
      <div class="card mei-card">
        <div class="mei-card__head">
          <div>
            <div class="mei-card__label">Limite MEI · ${ano}</div>
            <div class="mei-card__value">${utils.formatCurrency(faturado)} <span class="mei-card__limit">de ${utils.formatCurrency(limite)}</span></div>
          </div>
          <div class="mei-card__headright">
            <div class="mei-card__pct mei-card__pct--${nivel}">${utils.formatPercent(percent, 0)}</div>
            <button type="button" class="icon-button" title="Configurar limite do MEI" data-action="config-mei">${App.icons.get('sliders')}</button>
          </div>
        </div>
        <div class="mei-bar">
          <div class="mei-bar__fill mei-bar__fill--${nivel}" style="width:0%;" data-w="${larguraBarra}"></div>
        </div>
        <div class="mei-card__alerta mei-card__alerta--${nivel}">${alerta}</div>
        ${notaProporcional}
      </div>`;
  }

  // Presets de limite: MEI comum e MEI caminhoneiro (valores vigentes; o
  // usuário pode digitar outro valor se mudar). Mantidos aqui pra ficar fácil
  // de atualizar caso o governo reajuste.
  const PRESETS_MEI = [
    { rotulo: 'MEI (geral) — R$ 81.000', valor: 81000 },
    { rotulo: 'MEI Caminhoneiro — R$ 251.600', valor: 251600 },
  ];

  function abrirModalMei() {
    const cfg = state.getMeiConfig();
    const presetSelecionado = PRESETS_MEI.find((p) => p.valor === Number(cfg.limiteAnual));
    const bodyHtml = `
      <form class="form" data-form="mei">
        <p class="info-banner">O limite do MEI muda conforme a categoria (geral ou caminhoneiro) e é proporcional no ano em que você abriu o CNPJ.</p>
        <div class="form__row">
          <label>Tipo de MEI / limite anual
            <select name="preset">
              ${PRESETS_MEI.map((p) => `<option value="${p.valor}" ${presetSelecionado && presetSelecionado.valor === p.valor ? 'selected' : ''}>${p.rotulo}</option>`).join('')}
              <option value="custom" ${!presetSelecionado ? 'selected' : ''}>Outro valor…</option>
            </select>
          </label>
        </div>
        <div class="form__row ${presetSelecionado ? 'is-hidden' : ''}" data-field-wrap="limiteCustom">
          <label>Limite anual personalizado (R$)
            <input type="number" name="limiteCustom" step="0.01" min="0" value="${cfg.limiteAnual}" />
          </label>
        </div>
        <div class="form__row">
          <label>Mês de abertura do CNPJ (opcional)
            <input type="month" name="abertura" value="${utils.escapeHtml(cfg.abertura || '')}" />
          </label>
        </div>
        <p class="form__hint">Preencha a abertura só se quiser o rateio automático do primeiro ano. O mês de abertura conta como mês inteiro.</p>
        <div class="form__actions">
          <button type="button" class="button button--ghost" data-action="closeModal">Cancelar</button>
          <button type="submit" class="button button--primary">Salvar</button>
        </div>
      </form>`;
    App.modal.open({
      title: 'Configurar limite do MEI',
      bodyHtml,
      onMount(dialog) {
        const form = dialog.querySelector('form');
        const preset = form.elements.preset;
        const customWrap = dialog.querySelector('[data-field-wrap="limiteCustom"]');
        preset.addEventListener('change', () => {
          customWrap.classList.toggle('is-hidden', preset.value !== 'custom');
        });
        form.onsubmit = (e) => {
          e.preventDefault();
          const fd = new FormData(form);
          const limiteAnual = fd.get('preset') === 'custom'
            ? (Number(fd.get('limiteCustom')) || 0)
            : Number(fd.get('preset'));
          state.setMeiConfig({ limiteAnual, abertura: fd.get('abertura') || '' });
          App.toast.show('Limite do MEI atualizado.', 'sucesso');
          App.modal.close();
        };
      },
    });
  }

  function render(container) {
    const todas = state.getData().notasFiscais.slice().sort((a, b) => (a.dataEmissao < b.dataEmissao ? 1 : -1));
    const anos = state.anosDisponiveis();
    const listaFiltrada = filtroAno ? todas.filter((n) => utils.yearFromMonthRef(n.mesEmissao) === Number(filtroAno)) : todas;
    const lista = ordenar(listaFiltrada);
    const resumoAno = filtroAno ? state.notasFiscaisDoAno(Number(filtroAno)) : { quantidade: lista.length, total: utils.sum(lista, (n) => n.valor) };
    const anoMei = filtroAno ? Number(filtroAno) : utils.currentYear();

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

      ${renderMei(anoMei)}

      <div class="list-summary">${resumoAno.quantidade} nota${resumoAno.quantidade === 1 ? '' : 's'} emitida${resumoAno.quantidade === 1 ? '' : 's'} · Total faturado ${utils.formatCurrency(resumoAno.total)}</div>

      ${lista.length ? `
        <div class="data-list data-list--nfs">
          <div class="data-list__header">${th('numero', 'Nº da NF')}${th('mesEmissao', 'Mês de emissão')}${th('dataEmissao', 'Data de emissão')}${th('valor', 'Valor')}<span></span></div>
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

    // Anima a barra do MEI (0% -> valor) no próximo frame.
    requestAnimationFrame(() => {
      const barra = container.querySelector('.mei-bar__fill');
      if (barra) barra.style.width = barra.dataset.w + '%';
    });

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
      const cabecalho = e.target.closest('[data-sort]');
      if (cabecalho) {
        const col = cabecalho.dataset.sort;
        if (ordenacao.coluna === col) ordenacao.dir = ordenacao.dir === 'asc' ? 'desc' : 'asc';
        else ordenacao = { coluna: col, dir: ['valor', 'dataEmissao', 'mesEmissao', 'numero'].includes(col) ? 'desc' : 'asc' };
        render(container);
        return;
      }
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      const { action, id } = btn.dataset;
      if (action === 'nova-nf') abrirModalNF(null);
      else if (action === 'config-mei') abrirModalMei();
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
