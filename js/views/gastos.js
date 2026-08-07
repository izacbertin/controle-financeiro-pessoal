/*
 * Tela de Gastos: lista com filtros combináveis + modal de criação/edição.
 * É a tela mais usada no dia a dia, então "marcar como pago" é sempre 1 clique.
 */
window.App = window.App || {};
App.views = App.views || {};

App.views.gastos = (function () {
  const utils = App.utils;
  const state = App.state;

  let mostrarMaisFiltros = false;
  let debounceBusca = null;

  const NOVA_CATEGORIA_VALOR = '__nova__';
  const NOVO_CARTAO_VALOR = '__novo_cartao__';
  const faturasExpandidas = new Set(); // chaves "cartao||mes" abertas na lista

  // Ordenação da lista por coluna (clicando no cabeçalho). Padrão: vencimento
  // do mais recente pro mais antigo.
  let ordenacao = { coluna: 'vencimento', dir: 'desc' };

  function valorOrdenacao(g, coluna) {
    switch (coluna) {
      case 'descricao': return (g.descricao || '').toLowerCase();
      case 'categoria': return state.categoriaNome(g.categoriaId).toLowerCase();
      case 'tipo': return g.tipo || '';
      case 'valor': return state.valorLiquido(g);
      case 'mesReferencia': return g.mesReferencia || '';
      case 'status': return state.statusEfetivo(g);
      case 'vencimento':
      default: return g.vencimento || '';
    }
  }

  function ordenarLista(lista) {
    const mult = ordenacao.dir === 'asc' ? 1 : -1;
    return lista.slice().sort((a, b) => {
      const va = valorOrdenacao(a, ordenacao.coluna);
      const vb = valorOrdenacao(b, ordenacao.coluna);
      if (va < vb) return -1 * mult;
      if (va > vb) return 1 * mult;
      return 0;
    });
  }

  // Cabeçalho clicável com indicador de ordenação (▲/▼).
  function th(coluna, rotulo) {
    const ativo = ordenacao.coluna === coluna;
    const seta = ativo ? (ordenacao.dir === 'asc' ? ' ▲' : ' ▼') : '';
    return `<span class="th ${ativo ? 'is-sorted' : ''}" data-sort="${coluna}">${rotulo}${seta}</span>`;
  }

  // Descrições já usadas (únicas, mais recentes primeiro) para sugerir no
  // autocomplete e agilizar lançamentos repetidos (ex.: "Auto Posto Lavras").
  function descricoesUsadas() {
    const vistas = new Set();
    const lista = [];
    state.getData().gastos
      .slice()
      .sort((a, b) => (a.vencimento < b.vencimento ? 1 : -1))
      .forEach((g) => {
        const d = (g.descricao || '').trim();
        const chave = d.toLowerCase();
        if (d && !vistas.has(chave)) { vistas.add(chave); lista.push(d); }
      });
    return lista;
  }

  // Último gasto com a mesma descrição — usado pra pré-preencher categoria/tipo.
  function ultimoGastoPorDescricao(descricao) {
    const alvo = (descricao || '').trim().toLowerCase();
    if (!alvo) return null;
    return state.getData().gastos
      .filter((g) => (g.descricao || '').trim().toLowerCase() === alvo)
      .sort((a, b) => (a.vencimento < b.vencimento ? 1 : -1))[0] || null;
  }

  function mesesDisponiveis() {
    const meses = new Set();
    state.getData().gastos.forEach((g) => meses.add(g.mesReferencia));
    meses.add(utils.currentMonthRef());
    return Array.from(meses).filter(Boolean).sort().reverse();
  }

  function render(container) {
    const focused = container.querySelector(':focus');
    const focusInfo = focused && focused.dataset.preserve
      ? { name: focused.dataset.preserve, start: focused.selectionStart, end: focused.selectionEnd }
      : null;

    const f = state.getFiltros();
    const lista = state.gastosFiltrados();
    const categorias = state.listCategorias();
    const totalFiltrado = state.totais(lista);
    const filtrosAtivos = !!(f.mesReferencia || f.dataInicio || f.dataFim || f.categorias.length || f.tipos.length || f.status.length || f.busca);

    container.innerHTML = `
      <div class="view-header">
        <h1>Gastos</h1>
        <button type="button" class="button button--primary button--icon" data-action="novo-gasto">${App.icons.get('plus')} Novo gasto</button>
      </div>

      <div class="filter-bar">
        <input type="search" class="input input--search" placeholder="Buscar por descrição ou observação" value="${utils.escapeHtml(f.busca)}" data-preserve="busca" data-field="busca" />

        <select class="input" data-field="mesReferencia">
          <option value="">Todos os meses</option>
          ${mesesDisponiveis().map((m) => `<option value="${m}" ${f.mesReferencia === m ? 'selected' : ''}>${utils.escapeHtml(utils.monthRefToLabel(m))}</option>`).join('')}
        </select>

        <input type="date" class="input" data-field="dataInicio" value="${f.dataInicio}" title="Vencimento de" />
        <span class="filter-bar__sep">até</span>
        <input type="date" class="input" data-field="dataFim" value="${f.dataFim}" title="Vencimento até" />

        <details class="filter-dropdown">
          <summary class="button button--ghost button--icon">${App.icons.get('funnel')} Categoria ${f.categorias.length ? `(${f.categorias.length})` : ''}</summary>
          <div class="filter-dropdown__panel">
            ${categorias.map((c) => `
              <label class="checkbox-row">
                <input type="checkbox" data-toggle="categorias" value="${c.id}" ${f.categorias.includes(c.id) ? 'checked' : ''} />
                ${utils.escapeHtml(c.nome)}
              </label>`).join('')}
          </div>
        </details>

        <div class="chip-group" data-group="tipos">
          ${[['fixo', 'Fixo'], ['variavel', 'Variável']].map(([v, label]) => `
            <button type="button" class="chip ${f.tipos.includes(v) ? 'is-active' : ''}" data-toggle="tipos" data-value="${v}">${label}</button>`).join('')}
        </div>

        <div class="chip-group" data-group="status">
          ${[['pago', 'Pago'], ['pendente', 'Pendente'], ['atrasado', 'Atrasado']].map(([v, label]) => `
            <button type="button" class="chip ${f.status.includes(v) ? 'is-active' : ''}" data-toggle="status" data-value="${v}">${label}</button>`).join('')}
        </div>

        ${filtrosAtivos ? '<button type="button" class="button button--ghost" data-action="limpar-filtros">Limpar filtros</button>' : ''}
      </div>

      <div class="list-summary">
        ${lista.length} gasto${lista.length === 1 ? '' : 's'} · Total ${utils.formatCurrency(totalFiltrado.totalLiquido)} ·
        Pago ${utils.formatCurrency(totalFiltrado.totalPago)} · Pendente ${utils.formatCurrency(totalFiltrado.totalPendente)}
      </div>

      ${renderLista(lista)}
    `;

    if (focusInfo) {
      const el = container.querySelector(`[data-preserve="${focusInfo.name}"]`);
      if (el) {
        el.focus();
        if (typeof el.setSelectionRange === 'function') el.setSelectionRange(focusInfo.start, focusInfo.end);
      }
    }

    wireEvents(container);
  }

  // HTML de uma linha de gasto (usada solta ou como membro de uma fatura).
  // Membro de fatura NÃO tem pago/pendente próprio — o status (e o "pagar")
  // ficam na fatura. Aí a coluna de vencimento vira a DATA DA COMPRA.
  function linhaGastoHtml(g, membro) {
    const statusEfetivo = state.statusEfetivo(g);
    const statusCol = membro
      ? '<span class="data-list__obs">na fatura</span>'
      : `<span class="pill pill--${statusEfetivo}">${utils.statusLabel(statusEfetivo)}</span>`;
    const acoesStatus = membro
      ? ''
      : (g.status === 'pendente'
        ? `<button type="button" class="icon-button" title="Marcar como pago" data-action="pagar" data-id="${g.id}">${App.icons.get('check')}</button>`
        : `<button type="button" class="icon-button" title="Marcar como pendente" data-action="rependente" data-id="${g.id}">${App.icons.get('undo')}</button>`);
    return `
      <div class="data-list__row${membro ? ' data-list__row--membro' : ''}">
        <span class="data-list__descricao">
          ${utils.escapeHtml(g.descricao)}
          ${g.observacao ? `<span class="data-list__obs">${utils.escapeHtml(g.observacao)}</span>` : ''}
        </span>
        <span class="data-list__categoria"><span class="cat-icon">${App.icons.forCategoria(state.categoriaNome(g.categoriaId))}</span>${utils.escapeHtml(state.categoriaNome(g.categoriaId))}</span>
        <span>${g.tipo === 'fixo' ? 'Fixo' : 'Variável'}</span>
        <span class="valor-mono">${utils.formatCurrency(state.valorLiquido(g))}</span>
        <span>${utils.formatDate(g.vencimento)}${membro ? '<span class="data-list__obs">compra</span>' : ''}</span>
        <span>${utils.escapeHtml(utils.monthRefToShortLabel(g.mesReferencia))}</span>
        <span>${statusCol}</span>
        <span class="data-list__acoes">
          ${acoesStatus}
          <button type="button" class="icon-button" title="Editar" data-action="editar" data-id="${g.id}">${App.icons.get('pencil')}</button>
          <button type="button" class="icon-button" title="Excluir" data-action="excluir" data-id="${g.id}">${App.icons.get('trash')}</button>
        </span>
      </div>`;
  }

  function renderLista(listaOriginal) {
    if (!listaOriginal.length) {
      return '<p class="empty-hint empty-hint--block">Nenhum gasto encontrado com os filtros atuais.</p>';
    }
    const lista = ordenarLista(listaOriginal);

    // Separa gastos atrelados a cartão (agrupados em "faturas" por cartão+mês)
    // dos gastos avulsos. As faturas aparecem no topo; cada uma pode ser
    // expandida pra ver os lançamentos.
    const grupos = new Map();
    const avulsos = [];
    lista.forEach((g) => {
      if (g.cartao) {
        const chave = `${g.cartao}||${g.mesReferencia}`;
        if (!grupos.has(chave)) grupos.set(chave, { chave, cartao: g.cartao, mes: g.mesReferencia, itens: [] });
        grupos.get(chave).itens.push(g);
      } else {
        avulsos.push(g);
      }
    });

    const faturasHtml = Array.from(grupos.values())
      .sort((a, b) => (a.mes < b.mes ? 1 : -1))
      .map((grp) => {
        const total = utils.sum(grp.itens, state.valorLiquido);
        const aberta = faturasExpandidas.has(grp.chave);
        const status = state.faturaStatusEfetivo(grp.cartao, grp.mes);
        const venc = state.faturaVencimento(grp.cartao, grp.mes);
        const pago = status === 'pago';
        const cartaoAttr = utils.escapeHtml(grp.cartao);
        return `
          <div class="fatura fatura--${status}">
            <div class="fatura__head">
              <button type="button" class="fatura__toggle" data-action="toggle-fatura" data-key="${utils.escapeHtml(grp.chave)}">
                <span class="fatura__chevron ${aberta ? 'is-open' : ''}">${App.icons.get('chevron-right')}</span>
                <span class="cat-icon">${App.icons.get('cat-cartao')}</span>
                <span class="fatura__nome">Fatura ${cartaoAttr} · ${utils.escapeHtml(utils.monthRefToShortLabel(grp.mes))}</span>
                <span class="fatura__meta">${grp.itens.length} lanç.${venc ? ` · vence ${utils.formatDate(venc)}` : ' · sem vencimento'}</span>
              </button>
              <span class="pill pill--${status}">${utils.statusLabel(status)}</span>
              <span class="fatura__total valor-mono">${utils.formatCurrency(total)}</span>
              <span class="fatura__acoes">
                ${pago
                  ? `<button type="button" class="icon-button" title="Marcar fatura como pendente" data-action="rependente-fatura" data-cartao="${cartaoAttr}" data-mes="${grp.mes}">${App.icons.get('undo')}</button>`
                  : `<button type="button" class="icon-button" title="Marcar fatura como paga" data-action="pagar-fatura" data-cartao="${cartaoAttr}" data-mes="${grp.mes}">${App.icons.get('check')}</button>`}
              </span>
            </div>
            ${aberta ? grp.itens.map((g) => linhaGastoHtml(g, true)).join('') : ''}
          </div>`;
      }).join('');

    return `
      <div class="data-list">
        <div class="data-list__header">
          ${th('descricao', 'Descrição')}${th('categoria', 'Categoria')}${th('tipo', 'Tipo')}${th('valor', 'Valor')}${th('vencimento', 'Vencimento')}${th('mesReferencia', 'Mês ref.')}${th('status', 'Status')}<span></span>
        </div>
        ${faturasHtml}
        ${avulsos.map((g) => linhaGastoHtml(g, false)).join('')}
      </div>`;
  }

  // -----------------------------------------------------------------------
  // Modal de criação/edição
  // -----------------------------------------------------------------------

  function opcoesCategoria(categoriaSelecionada) {
    const categorias = state.listCategorias();
    return `
      ${categorias.map((c) => `<option value="${c.id}" ${c.id === categoriaSelecionada ? 'selected' : ''}>${utils.escapeHtml(c.nome)}</option>`).join('')}
      <option value="${NOVA_CATEGORIA_VALOR}">+ Nova categoria…</option>`;
  }

  function abrirModalGasto(gastoExistente) {
    const g = gastoExistente || {
      descricao: '', categoriaId: '', tipo: 'variavel', valor: '', desconto: '',
      vencimento: utils.todayISO(), status: 'pendente', dataPagamento: '',
      mesReferencia: utils.currentMonthRef(), observacao: '',
    };

    const bodyHtml = `
      <form class="form" data-form="gasto">
        <div class="form__row">
          <label>Descrição
            <input type="text" name="descricao" required value="${utils.escapeHtml(g.descricao)}" placeholder="Ex.: Nubank" list="descricoes-usadas" autocomplete="off" />
            <datalist id="descricoes-usadas">
              ${descricoesUsadas().map((d) => `<option value="${utils.escapeHtml(d)}"></option>`).join('')}
            </datalist>
          </label>
        </div>

        <div class="form__row form__row--2">
          <label>Categoria
            <select name="categoriaId" required>
              <option value="" disabled ${g.categoriaId ? '' : 'selected'}>Selecione…</option>
              ${opcoesCategoria(g.categoriaId)}
            </select>
          </label>
          <label>Tipo
            <select name="tipo">
              <option value="variavel" ${g.tipo === 'variavel' ? 'selected' : ''}>Variável</option>
              <option value="fixo" ${g.tipo === 'fixo' ? 'selected' : ''}>Fixo</option>
            </select>
          </label>
        </div>

        <div class="form__row is-hidden" data-field-wrap="novaCategoria">
          <label>Nome da nova categoria
            <input type="text" name="novaCategoria" placeholder="Ex.: Educação" />
          </label>
        </div>

        <div class="form__row form__row--2">
          <label>Cartão de crédito (opcional)
            <select name="cartao">
              <option value="" ${!g.cartao ? 'selected' : ''}>Nenhum</option>
              ${state.listCartoes().map((c) => `<option value="${utils.escapeHtml(c.nome)}" ${g.cartao === c.nome ? 'selected' : ''}>${utils.escapeHtml(c.nome)}</option>`).join('')}
              <option value="${NOVO_CARTAO_VALOR}">+ Novo cartão…</option>
            </select>
          </label>
          <label class="is-hidden" data-field-wrap="novoCartao">Nome do novo cartão
            <input type="text" name="novoCartao" placeholder="Ex.: PicPay" />
          </label>
        </div>

        <div class="form__row form__row--2 is-hidden" data-field-wrap="novoCartaoDatas">
          <label>Dia de fechamento
            <input type="number" name="novoCartaoFechamento" min="1" max="31" placeholder="Ex.: 3" />
          </label>
          <label>Dia de vencimento
            <input type="number" name="novoCartaoVencimento" min="1" max="31" placeholder="Ex.: 10" />
          </label>
        </div>

        <div class="form__row form__row--2">
          <label>Valor (R$)
            <input type="number" name="valor" step="0.01" min="0" required value="${g.valor}" />
          </label>
          <label>Desconto (opcional)
            <input type="number" name="desconto" step="0.01" min="0" value="${g.desconto || ''}" />
          </label>
        </div>

        <div class="form__row form__row--2">
          <label><span data-role="vencimento-label">Vencimento</span>
            <input type="date" name="vencimento" required value="${g.vencimento}" />
          </label>
          <label data-field-wrap="mesReferencia"><span data-role="mesref-label">Mês de referência</span>
            <input type="month" name="mesReferencia" required value="${g.mesReferencia}" />
          </label>
        </div>

        <p class="form__hint is-hidden" data-role="fatura-nota"></p>

        <div class="form__row form__row--2" data-field-wrap="statusRow">
          <label>Status
            <select name="status">
              <option value="pendente" ${g.status === 'pendente' ? 'selected' : ''}>Pendente</option>
              <option value="pago" ${g.status === 'pago' ? 'selected' : ''}>Pago</option>
            </select>
          </label>
          <label data-field-wrap="dataPagamento" class="${g.status === 'pago' ? '' : 'is-hidden'}">Data de pagamento
            <input type="date" name="dataPagamento" value="${g.dataPagamento || utils.todayISO()}" />
          </label>
        </div>

        <div class="form__row">
          <label>Observação (opcional)
            <textarea name="observacao" rows="2" placeholder="Ex.: Referente a junho e julho">${utils.escapeHtml(g.observacao || '')}</textarea>
          </label>
        </div>

        ${gastoExistente ? '' : `
        <div class="form__row form__row--2">
          <label>Repetição
            <select name="repeticaoModo">
              <option value="unico">Único</option>
              <option value="mensal">Repetir mensalmente</option>
              <option value="parcelado">Parcelado</option>
            </select>
          </label>
          <label class="is-hidden" data-field-wrap="repeticaoQtd">
            <span data-role="repeticao-qtd-label">Nº de meses</span>
            <input type="number" name="repeticaoQtd" min="2" max="60" value="12" />
          </label>
        </div>
        <p class="form__hint is-hidden" data-role="repeticao-hint"></p>`}

        <div class="form__actions">
          <button type="button" class="button button--ghost" data-action="closeModal">Cancelar</button>
          <button type="submit" class="button button--primary">Salvar</button>
        </div>
      </form>`;

    App.modal.open({
      title: gastoExistente ? 'Editar gasto' : 'Novo gasto',
      bodyHtml,
      onMount(dialog) {
        const form = dialog.querySelector('form');
        const categoriaSelect = form.elements.categoriaId;
        const novaCategoriaWrap = dialog.querySelector('[data-field-wrap="novaCategoria"]');
        const statusSelect = form.elements.status;
        const dataPagamentoWrap = dialog.querySelector('[data-field-wrap="dataPagamento"]');

        categoriaSelect.addEventListener('change', () => {
          novaCategoriaWrap.classList.toggle('is-hidden', categoriaSelect.value !== NOVA_CATEGORIA_VALOR);
        });
        statusSelect.addEventListener('change', () => {
          dataPagamentoWrap.classList.toggle('is-hidden', statusSelect.value !== 'pago');
        });

        // Cartão: ao escolher um cartão (ou "+ novo cartão"), o gasto vira uma
        // compra de fatura — some o status por compra e o mês de referência
        // (calculado pela data da compra + dias do cartão), e o campo de
        // "Vencimento" passa a significar "Data da compra".
        const cartaoSelect = form.elements.cartao;
        const novoCartaoWrap = dialog.querySelector('[data-field-wrap="novoCartao"]');
        const novoCartaoDatasWrap = dialog.querySelector('[data-field-wrap="novoCartaoDatas"]');
        const statusRow = dialog.querySelector('[data-field-wrap="statusRow"]');
        const mesRefLabel = dialog.querySelector('[data-role="mesref-label"]');
        const mesRefInput = form.elements.mesReferencia;
        const vencimentoLabel = dialog.querySelector('[data-role="vencimento-label"]');
        const faturaNota = dialog.querySelector('[data-role="fatura-nota"]');
        const vencimentoInput = form.elements.vencimento;

        // O campo de fatura (mês de referência) é sugerido automaticamente a
        // partir da data da compra + dias do cartão, mas o usuário pode trocar.
        // Uma vez editado à mão, paramos de sobrescrever a escolha dele.
        let mesRefManual = false;
        mesRefInput.addEventListener('input', () => { mesRefManual = true; });

        // Calcula a fatura sugerida para a compra atual (ou null se não der).
        function faturaSugerida() {
          const cartaoVal = cartaoSelect.value;
          const dataCompra = vencimentoInput.value;
          if (cartaoVal === NOVO_CARTAO_VALOR) {
            const F = form.elements.novoCartaoFechamento.value;
            const V = form.elements.novoCartaoVencimento.value;
            const f = utils.calcularFatura(dataCompra, F, V);
            if (f) return f.mesRef;
            return dataCompra ? utils.addMonths(utils.monthRefFromDate(dataCompra), 1) : null;
          }
          if (cartaoVal) return state.mesRefFaturaParaCompra(cartaoVal, dataCompra);
          return null;
        }

        // Atualiza a sugestão de fatura e a nota explicativa. `preencher` diz se
        // devemos jogar a sugestão no campo (só em mudanças do usuário, nunca na
        // montagem inicial — para não apagar o valor de um gasto em edição).
        function atualizarNotaFatura(preencher) {
          const cartaoVal = cartaoSelect.value;
          if (!cartaoVal) { faturaNota.classList.add('is-hidden'); return; }
          const mesRef = faturaSugerida();
          if (preencher && mesRef && !mesRefManual) mesRefInput.value = mesRef;
          const cartaoObj = cartaoVal === NOVO_CARTAO_VALOR ? null : state.getCartao(cartaoVal);
          const temDias = cartaoVal === NOVO_CARTAO_VALOR
            ? !!(form.elements.novoCartaoFechamento.value && form.elements.novoCartaoVencimento.value)
            : !!(cartaoObj && cartaoObj.diaFechamento && cartaoObj.diaVencimento);
          faturaNota.classList.remove('is-hidden');
          faturaNota.textContent = temDias
            ? `Sugestão pelo fechamento do cartão: fatura de ${utils.monthRefToLabel(mesRefInput.value || mesRef)}. Você pode trocar acima.`
            : 'Cartão sem dias de fechamento cadastrados — confira o mês da fatura acima (sugerido: mês seguinte à compra).';
        }

        function atualizarModoCartao(preencher) {
          const ehCartao = !!cartaoSelect.value; // cartão escolhido ou "+ novo"
          const ehNovo = cartaoSelect.value === NOVO_CARTAO_VALOR;
          novoCartaoWrap.classList.toggle('is-hidden', !ehNovo);
          novoCartaoDatasWrap.classList.toggle('is-hidden', !ehNovo);
          statusRow.classList.toggle('is-hidden', ehCartao);
          mesRefLabel.textContent = ehCartao ? 'Fatura (mês de referência)' : 'Mês de referência';
          vencimentoLabel.textContent = ehCartao ? 'Data da compra' : 'Vencimento';
          atualizarNotaFatura(preencher);
        }
        cartaoSelect.addEventListener('change', () => atualizarModoCartao(true));
        vencimentoInput.addEventListener('change', () => atualizarNotaFatura(true));
        ['novoCartaoFechamento', 'novoCartaoVencimento'].forEach((n) => {
          form.elements[n].addEventListener('input', () => atualizarNotaFatura(true));
        });
        atualizarModoCartao(false);

        // Autocomplete: ao digitar/escolher uma descrição já usada, pré-preenche
        // categoria e tipo com base no último lançamento igual (só ao CRIAR, e
        // só se a categoria ainda não foi escolhida — não atrapalha edição).
        if (!gastoExistente) {
          form.elements.descricao.addEventListener('change', () => {
            const anterior = ultimoGastoPorDescricao(form.elements.descricao.value);
            if (!anterior) return;
            if (!categoriaSelect.value) categoriaSelect.value = anterior.categoriaId;
            form.elements.tipo.value = anterior.tipo;
          });
        }

        // Repetição (só existe ao criar): mostra/oculta a quantidade e ajusta
        // o rótulo/dica conforme "mensal" ou "parcelado".
        const repeticaoModo = form.elements.repeticaoModo;
        if (repeticaoModo) {
          const qtdWrap = dialog.querySelector('[data-field-wrap="repeticaoQtd"]');
          const qtdLabel = dialog.querySelector('[data-role="repeticao-qtd-label"]');
          const hint = dialog.querySelector('[data-role="repeticao-hint"]');
          repeticaoModo.addEventListener('change', () => {
            const modo = repeticaoModo.value;
            qtdWrap.classList.toggle('is-hidden', modo === 'unico');
            hint.classList.toggle('is-hidden', modo === 'unico');
            if (modo === 'mensal') {
              qtdLabel.textContent = 'Repetir por (meses)';
              hint.textContent = 'Cria vários lançamentos iguais, um em cada mês seguinte.';
            } else if (modo === 'parcelado') {
              qtdLabel.textContent = 'Nº de parcelas';
              hint.textContent = 'Cria as parcelas (1/N, 2/N…), uma por mês. O valor informado é o de CADA parcela.';
            }
          });
        }

        form.onsubmit = (e) => {
          e.preventDefault();
          const fd = new FormData(form);
          let categoriaId = fd.get('categoriaId');
          if (categoriaId === NOVA_CATEGORIA_VALOR) {
            const nome = String(fd.get('novaCategoria') || '').trim();
            if (!nome) {
              form.elements.novaCategoria.focus();
              return;
            }
            categoriaId = state.addCategoria(nome).id;
          }
          let cartao = fd.get('cartao') || '';
          if (cartao === NOVO_CARTAO_VALOR) {
            const nomeCartao = String(fd.get('novoCartao') || '').trim();
            if (!nomeCartao) { form.elements.novoCartao.focus(); return; }
            const obj = state.addCartao(nomeCartao, fd.get('novoCartaoFechamento'), fd.get('novoCartaoVencimento'));
            cartao = obj.nome;
          }
          const status = fd.get('status');
          // Data que o usuário informou: p/ gasto avulso é o vencimento; p/
          // compra de cartão é a DATA DA COMPRA (o mesmo campo de input).
          const dataInformada = fd.get('vencimento');
          // Compra de cartão não tem pago/pendente próprio; o mês de referência
          // é o da FATURA. Vem do campo (sugerido pela data da compra + dias do
          // cartão, mas editável), com fallback pro cálculo automático.
          const payload = cartao
            ? {
              descricao: String(fd.get('descricao') || '').trim(),
              categoriaId,
              tipo: fd.get('tipo'),
              valor: Number(fd.get('valor')) || 0,
              desconto: Number(fd.get('desconto')) || 0,
              vencimento: dataInformada,
              mesReferencia: fd.get('mesReferencia') || state.mesRefFaturaParaCompra(cartao, dataInformada),
              status: 'pendente',
              dataPagamento: '',
              observacao: String(fd.get('observacao') || '').trim(),
              cartao,
            }
            : {
              descricao: String(fd.get('descricao') || '').trim(),
              categoriaId,
              tipo: fd.get('tipo'),
              valor: Number(fd.get('valor')) || 0,
              desconto: Number(fd.get('desconto')) || 0,
              vencimento: dataInformada,
              mesReferencia: fd.get('mesReferencia'),
              status,
              dataPagamento: status === 'pago' ? (fd.get('dataPagamento') || utils.todayISO()) : '',
              observacao: String(fd.get('observacao') || '').trim(),
              cartao: '',
            };
          if (gastoExistente) {
            state.updateGasto(gastoExistente.id, payload);
            App.toast.show('Gasto atualizado.', 'sucesso');
          } else {
            const modo = fd.get('repeticaoModo') || 'unico';
            const qtd = Math.max(2, Math.min(60, Number(fd.get('repeticaoQtd')) || 2));
            if (modo === 'mensal' || modo === 'parcelado') {
              const criados = state.addGastosLote(payload, { modo, quantidade: qtd });
              App.toast.show(`${criados.length} lançamentos criados.`, 'sucesso');
            } else {
              state.addGasto(payload);
              App.toast.show('Gasto adicionado.', 'sucesso');
            }
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
        if (ordenacao.coluna === col) {
          ordenacao.dir = ordenacao.dir === 'asc' ? 'desc' : 'asc';
        } else {
          // Texto começa em A→Z; número/data começam do maior/mais recente.
          ordenacao = { coluna: col, dir: ['valor', 'vencimento', 'mesReferencia'].includes(col) ? 'desc' : 'asc' };
        }
        render(container);
        return;
      }

      const chip = e.target.closest('[data-toggle]');
      if (chip && chip.tagName === 'BUTTON') {
        const grupo = chip.dataset.toggle;
        const valor = chip.dataset.value;
        const atual = state.getFiltros()[grupo];
        const novo = atual.includes(valor) ? atual.filter((v) => v !== valor) : [...atual, valor];
        state.setFiltro(grupo, novo);
        return;
      }

      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      const { action, id } = btn.dataset;
      if (action === 'toggle-fatura') {
        const key = btn.dataset.key;
        if (faturasExpandidas.has(key)) faturasExpandidas.delete(key);
        else faturasExpandidas.add(key);
        render(container);
      }
      else if (action === 'novo-gasto') abrirModalGasto(null);
      else if (action === 'editar') abrirModalGasto(state.getData().gastos.find((g) => g.id === id));
      else if (action === 'pagar') { state.marcarGastoPago(id); App.toast.show('Gasto marcado como pago.', 'sucesso'); }
      else if (action === 'rependente') state.marcarGastoPendente(id);
      else if (action === 'pagar-fatura') { state.marcarFaturaPaga(btn.dataset.cartao, btn.dataset.mes); App.toast.show('Fatura marcada como paga.', 'sucesso'); }
      else if (action === 'rependente-fatura') state.marcarFaturaPendente(btn.dataset.cartao, btn.dataset.mes);
      else if (action === 'excluir') {
        if (window.confirm('Excluir este gasto? Essa ação não pode ser desfeita.')) {
          state.deleteGasto(id);
          App.toast.show('Gasto excluído.', 'info');
        }
      } else if (action === 'limpar-filtros') {
        state.limparFiltros();
      }
    };

    container.onchange = (e) => {
      const el = e.target;
      if (el.dataset.toggle === 'categorias') {
        const atual = state.getFiltros().categorias;
        const novo = el.checked ? [...atual, el.value] : atual.filter((v) => v !== el.value);
        state.setFiltro('categorias', novo);
        return;
      }
      if (el.dataset.field && el.dataset.field !== 'busca') {
        state.setFiltro(el.dataset.field, el.value);
      }
    };

    container.oninput = (e) => {
      if (e.target.dataset.field === 'busca') {
        clearTimeout(debounceBusca);
        const valor = e.target.value;
        debounceBusca = setTimeout(() => state.setFiltro('busca', valor), 250);
      }
    };
  }

  return { render };
})();
