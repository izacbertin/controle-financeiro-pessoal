/*
 * Estado central da aplicação: guarda os dados carregados do localStorage,
 * os filtros ativos, e expõe métodos de CRUD + "seletores" (cálculos
 * derivados: totais, indicadores do dashboard, consolidado mensal/anual).
 *
 * Padrão usado: um objeto único (App.state) com um pub/sub simples.
 * Qualquer mutação chama persist() + notify(), e quem desenhou a tela
 * (App.app) escuta notify() para re-renderizar. Não há um framework aqui
 * de propósito — a escala de dados de um controle financeiro pessoal não
 * justifica isso, e fica mais fácil de qualquer pessoa ler o código depois.
 */
window.App = window.App || {};

App.state = (function () {
  const utils = App.utils;
  let data = null; // { categorias, gastos, receitas, notasFiscais, preferencias }
  const listeners = [];

  const filtrosPadrao = () => ({
    mesReferencia: '',      // '' = todos os meses
    dataInicio: '',
    dataFim: '',
    categorias: [],         // ids selecionados (vazio = todas)
    tipos: [],              // 'fixo' | 'variavel'
    status: [],             // 'pago' | 'pendente' | 'atrasado'
    busca: '',
  });

  let filtros = filtrosPadrao();

  const ui = {
    view: 'dashboard',
    dashboardMonth: utils.currentMonthRef(),
    consolidadoModo: 'mensal',   // 'mensal' | 'anual'
    consolidadoMonth: utils.currentMonthRef(),
    consolidadoYear: utils.currentYear(),
  };

  function init() {
    data = App.storage.load();
  }

  function persist() {
    App.storage.save(data);
  }

  function subscribe(fn) {
    listeners.push(fn);
  }

  function notify() {
    listeners.forEach((fn) => fn());
  }

  function getData() {
    return data;
  }

  function getUI() {
    return ui;
  }

  function setUI(patch) {
    Object.assign(ui, patch);
    notify();
  }

  function replaceData(novoEstado) {
    data = novoEstado;
    filtros = filtrosPadrao();
    persist();
    notify();
  }

  function resetAll() {
    data = App.storage.resetAll();
    filtros = filtrosPadrao();
    notify();
  }

  function getTema() {
    return data.preferencias.tema || 'sistema';
  }

  function setTema(tema) {
    data.preferencias.tema = tema;
    persist();
    notify();
  }

  // ---------------------------------------------------------------------
  // Configuração do MEI (limite anual + rateio do ano de abertura)
  // ---------------------------------------------------------------------

  function getMeiConfig() {
    return Object.assign({ limiteAnual: utils.LIMITE_MEI_ANUAL, abertura: '' }, data.preferencias.mei);
  }

  function setMeiConfig(patch) {
    data.preferencias.mei = Object.assign(getMeiConfig(), patch);
    persist();
    notify();
  }

  // Limite do MEI para um ano específico. Se o CNPJ foi aberto naquele mesmo
  // ano, o limite é proporcional: (limite/12) × meses do mês de abertura até
  // dezembro (o mês de abertura já conta como mês inteiro). Anos completos
  // seguintes usam o limite cheio. Devolve { limite, proporcional, meses }.
  function limiteMeiDoAno(ano) {
    const cfg = getMeiConfig();
    const base = Number(cfg.limiteAnual) || utils.LIMITE_MEI_ANUAL;
    if (cfg.abertura) {
      const [ay, am] = cfg.abertura.split('-').map(Number);
      if (ano < ay) return { limite: 0, proporcional: true, meses: 0 };
      if (ano === ay) {
        const meses = 12 - am + 1;
        return { limite: Math.round((base / 12) * meses), proporcional: meses < 12, meses };
      }
    }
    return { limite: base, proporcional: false, meses: 12 };
  }

  // ---------------------------------------------------------------------
  // Categorias
  // ---------------------------------------------------------------------

  function listCategorias() {
    return data.categorias.slice().sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  }

  function categoriaNome(categoriaId) {
    const cat = data.categorias.find((c) => c.id === categoriaId);
    return cat ? cat.nome : 'Sem categoria';
  }

  function addCategoria(nome) {
    const nomeLimpo = nome.trim();
    if (!nomeLimpo) return null;
    const existente = data.categorias.find((c) => c.nome.toLowerCase() === nomeLimpo.toLowerCase());
    if (existente) return existente;
    const nova = { id: utils.uuid(), nome: nomeLimpo };
    data.categorias.push(nova);
    persist();
    notify();
    return nova;
  }

  // ---------------------------------------------------------------------
  // Cartões de crédito (nomes) — usados p/ agrupar gastos em faturas
  // ---------------------------------------------------------------------

  function listCartoes() {
    return (data.cartoes || []).slice().sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }

  function addCartao(nome) {
    const limpo = (nome || '').trim();
    if (!limpo) return null;
    if (!data.cartoes) data.cartoes = [];
    const existe = data.cartoes.find((c) => c.toLowerCase() === limpo.toLowerCase());
    if (existe) return existe;
    data.cartoes.push(limpo);
    persist();
    notify();
    return limpo;
  }

  // ---------------------------------------------------------------------
  // Gastos
  // ---------------------------------------------------------------------

  function addGasto(gasto) {
    const novo = Object.assign({ id: utils.uuid(), desconto: 0 }, gasto);
    data.gastos.push(novo);
    persist();
    notify();
    return novo;
  }

  // Cria vários gastos de uma vez (recorrência mensal ou parcelamento).
  // repeticao: { modo: 'mensal' | 'parcelado', quantidade: N }
  //  - 'mensal':   N cópias iguais, uma por mês consecutivo.
  //  - 'parcelado': N parcelas; a descrição ganha "(i/N)" e cada uma cai num
  //                 mês consecutivo. O `valor` informado é o de CADA parcela.
  // Vencimento e mês de referência avançam 1 mês a cada repetição.
  function addGastosLote(gastoBase, repeticao) {
    const qtd = Math.max(1, Number(repeticao && repeticao.quantidade) || 1);
    const modo = repeticao && repeticao.modo;
    const criados = [];
    for (let i = 0; i < qtd; i++) {
      const copia = Object.assign({ id: utils.uuid(), desconto: 0 }, gastoBase);
      copia.vencimento = avancarDataMeses(gastoBase.vencimento, i);
      copia.mesReferencia = utils.addMonths(gastoBase.mesReferencia, i);
      if (modo === 'parcelado' && qtd > 1) {
        copia.descricao = `${gastoBase.descricao} (${i + 1}/${qtd})`;
      }
      // Só a primeira pode herdar "pago"; as futuras nascem pendentes.
      if (i > 0) { copia.status = 'pendente'; copia.dataPagamento = ''; }
      data.gastos.push(copia);
      criados.push(copia);
    }
    persist();
    notify();
    return criados;
  }

  // Avança uma data ISO em N meses, preservando o dia quando possível
  // (cai no último dia do mês se o dia não existir, ex.: 31 -> 30).
  function avancarDataMeses(isoDate, n) {
    if (!isoDate || !n) return isoDate;
    const [y, m, d] = isoDate.split('-').map(Number);
    const alvo = new Date(Date.UTC(y, m - 1 + n, 1));
    const ultimoDia = new Date(Date.UTC(alvo.getUTCFullYear(), alvo.getUTCMonth() + 1, 0)).getUTCDate();
    const dia = Math.min(d, ultimoDia);
    return `${alvo.getUTCFullYear()}-${utils.pad(alvo.getUTCMonth() + 1)}-${utils.pad(dia)}`;
  }

  function updateGasto(id, patch) {
    const gasto = data.gastos.find((g) => g.id === id);
    if (!gasto) return;
    Object.assign(gasto, patch);
    persist();
    notify();
  }

  function deleteGasto(id) {
    data.gastos = data.gastos.filter((g) => g.id !== id);
    persist();
    notify();
  }

  function marcarGastoPago(id) {
    updateGasto(id, { status: 'pago', dataPagamento: utils.todayISO() });
  }

  function marcarGastoPendente(id) {
    updateGasto(id, { status: 'pendente', dataPagamento: '' });
  }

  // ---------------------------------------------------------------------
  // Receitas (uma ou mais entradas por mês de referência — ex.: salário +
  // um extra do mês — o consolidado soma todas as entradas do mês).
  // ---------------------------------------------------------------------

  function addReceita(receita) {
    const nova = Object.assign({ id: utils.uuid() }, receita);
    data.receitas.push(nova);
    persist();
    notify();
    return nova;
  }

  function updateReceita(id, patch) {
    const receita = data.receitas.find((r) => r.id === id);
    if (!receita) return;
    Object.assign(receita, patch);
    persist();
    notify();
  }

  function deleteReceita(id) {
    data.receitas = data.receitas.filter((r) => r.id !== id);
    persist();
    notify();
  }

  // Receita do mês vem só dos lançamentos manuais de Receitas. As notas
  // fiscais são um controle à parte (faturamento emitido) e NÃO entram
  // automaticamente aqui — o usuário lança a receita quando quer, o que
  // permite programar gastos de um mês antes de ter emitido a nota dele.
  function receitaDoMes(mesReferencia) {
    return utils.sum(data.receitas.filter((r) => r.mesReferencia === mesReferencia), (r) => r.valor);
  }

  // ---------------------------------------------------------------------
  // Notas fiscais
  // ---------------------------------------------------------------------

  function addNotaFiscal(nf) {
    const nova = Object.assign({ id: utils.uuid() }, nf);
    data.notasFiscais.push(nova);
    persist();
    notify();
    return nova;
  }

  function updateNotaFiscal(id, patch) {
    const nf = data.notasFiscais.find((n) => n.id === id);
    if (!nf) return;
    Object.assign(nf, patch);
    persist();
    notify();
  }

  function deleteNotaFiscal(id) {
    data.notasFiscais = data.notasFiscais.filter((n) => n.id !== id);
    persist();
    notify();
  }

  // ---------------------------------------------------------------------
  // Filtros (tela de Gastos)
  // ---------------------------------------------------------------------

  function getFiltros() {
    return filtros;
  }

  function setFiltro(chave, valor) {
    filtros[chave] = valor;
    notify();
  }

  function limparFiltros() {
    filtros = filtrosPadrao();
    notify();
  }

  function statusEfetivo(gasto) {
    if (gasto.status === 'pendente' && utils.isOverdue(gasto)) return 'atrasado';
    return gasto.status;
  }

  function aplicarFiltros(lista, f) {
    const busca = (f.busca || '').trim().toLowerCase();
    return lista.filter((g) => {
      if (f.mesReferencia && g.mesReferencia !== f.mesReferencia) return false;
      if (f.dataInicio && g.vencimento < f.dataInicio) return false;
      if (f.dataFim && g.vencimento > f.dataFim) return false;
      if (f.categorias.length && !f.categorias.includes(g.categoriaId)) return false;
      if (f.tipos.length && !f.tipos.includes(g.tipo)) return false;
      if (f.status.length && !f.status.includes(statusEfetivo(g))) return false;
      if (busca) {
        const alvo = `${g.descricao} ${g.observacao || ''}`.toLowerCase();
        if (!alvo.includes(busca)) return false;
      }
      return true;
    });
  }

  function gastosFiltrados() {
    return aplicarFiltros(data.gastos, filtros)
      .slice()
      .sort((a, b) => (a.vencimento < b.vencimento ? 1 : -1));
  }

  // ---------------------------------------------------------------------
  // Orçamentos por categoria (teto de gasto mensal)
  // ---------------------------------------------------------------------

  function getOrcamentos() {
    return data.orcamentos || {};
  }

  // Define (ou remove, se valor <= 0) o teto mensal de uma categoria.
  function setOrcamento(categoriaId, valor) {
    if (!data.orcamentos) data.orcamentos = {};
    const v = Number(valor) || 0;
    if (v > 0) data.orcamentos[categoriaId] = v;
    else delete data.orcamentos[categoriaId];
    persist();
    notify();
  }

  // Define todos os orçamentos de uma vez (usado pelo modal "Definir
  // orçamentos"), evitando um re-render por categoria.
  function setOrcamentosEmLote(mapa) {
    const novo = {};
    Object.keys(mapa || {}).forEach((id) => {
      const v = Number(mapa[id]) || 0;
      if (v > 0) novo[id] = v;
    });
    data.orcamentos = novo;
    persist();
    notify();
  }

  // Situação do orçamento de cada categoria COM teto definido, no mês dado:
  // [{ categoriaId, nome, limite, gasto, percent, estourou }]
  function orcamentoStatusDoMes(mesReferencia) {
    const orcs = getOrcamentos();
    const gastosMes = gastosDoMes(mesReferencia);
    return Object.keys(orcs).map((categoriaId) => {
      const limite = orcs[categoriaId];
      const gasto = utils.sum(gastosMes.filter((g) => g.categoriaId === categoriaId), valorLiquido);
      return {
        categoriaId,
        nome: categoriaNome(categoriaId),
        limite,
        gasto,
        percent: limite > 0 ? (gasto / limite) * 100 : 0,
        estourou: gasto > limite,
      };
    }).sort((a, b) => b.percent - a.percent);
  }

  // ---------------------------------------------------------------------
  // Seletores / indicadores (usados pelo Dashboard)
  // ---------------------------------------------------------------------

  function valorLiquido(gasto) {
    return (Number(gasto.valor) || 0) - (Number(gasto.desconto) || 0);
  }

  function gastosDoMes(mesReferencia) {
    return data.gastos.filter((g) => g.mesReferencia === mesReferencia);
  }

  function gastosDoAno(ano) {
    return data.gastos.filter((g) => utils.yearFromMonthRef(g.mesReferencia) === ano);
  }

  function totais(lista) {
    const totalBruto = utils.sum(lista, (g) => g.valor);
    const totalDesconto = utils.sum(lista, (g) => g.desconto);
    const totalLiquido = totalBruto - totalDesconto;
    const pagos = lista.filter((g) => g.status === 'pago');
    const pendentes = lista.filter((g) => g.status === 'pendente');
    const totalPago = utils.sum(pagos, valorLiquido);
    const totalPendente = utils.sum(pendentes, valorLiquido);
    return {
      totalBruto, totalDesconto, totalLiquido, totalPago, totalPendente,
      percentPago: totalLiquido > 0 ? (totalPago / totalLiquido) * 100 : 0,
      quantidade: lista.length,
    };
  }

  function gastosPorCategoria(lista) {
    const mapa = new Map();
    lista.forEach((g) => {
      const atual = mapa.get(g.categoriaId) || 0;
      mapa.set(g.categoriaId, atual + valorLiquido(g));
    });
    const total = utils.sum(lista, valorLiquido);
    return Array.from(mapa.entries())
      .map(([categoriaId, valor]) => ({
        categoriaId,
        nome: categoriaNome(categoriaId),
        valor,
        percentual: total > 0 ? (valor / total) * 100 : 0,
      }))
      .sort((a, b) => b.valor - a.valor);
  }

  function comparativoFixoVariavel(lista) {
    const fixo = utils.sum(lista.filter((g) => g.tipo === 'fixo'), valorLiquido);
    const variavel = utils.sum(lista.filter((g) => g.tipo === 'variavel'), valorLiquido);
    const total = fixo + variavel;
    return [
      { chave: 'fixo', nome: 'Fixo', valor: fixo, percentual: total > 0 ? (fixo / total) * 100 : 0 },
      { chave: 'variavel', nome: 'Variável', valor: variavel, percentual: total > 0 ? (variavel / total) * 100 : 0 },
    ];
  }

  // Atrasados e próximos vencimentos olham TODOS os gastos pendentes,
  // independente do mês de referência selecionado — são avisos sobre o que
  // precisa de atenção agora, não um recorte do orçamento de um mês específico.
  function gastosAtrasados() {
    return data.gastos
      .filter((g) => utils.isOverdue(g))
      .sort((a, b) => (a.vencimento < b.vencimento ? -1 : 1));
  }

  function proximosVencimentos(dias) {
    const hoje = utils.todayISO();
    return data.gastos
      .filter((g) => g.status === 'pendente' && g.vencimento >= hoje)
      .filter((g) => {
        const restante = utils.daysUntil(g.vencimento);
        return restante != null && restante <= dias;
      })
      .sort((a, b) => (a.vencimento < b.vencimento ? -1 : 1));
  }

  // Todos os meses que têm algum lançamento (receita ou gasto). Usado pelo
  // saldo acumulado pra saber o que existe "antes" do mês consultado.
  function mesesComMovimento() {
    const set = new Set();
    data.gastos.forEach((g) => set.add(g.mesReferencia));
    data.receitas.forEach((r) => set.add(r.mesReferencia));
    return Array.from(set).filter(Boolean);
  }

  // Saldo que entra no mês, acumulado de TODOS os meses anteriores: para cada
  // mês < mesReferencia soma (receita lançada − despesa líquida) e acumula.
  // É um saldo corrente de verdade — carrega sobra (positivo) E estouro
  // (negativo), pra nunca mostrar dinheiro que não existe. Strings "YYYY-MM"
  // comparam corretamente em ordem cronológica.
  function saldoAcumuladoAntesDe(mesReferencia) {
    return mesesComMovimento()
      .filter((m) => m < mesReferencia)
      .reduce((acc, m) => acc + (receitaDoMes(m) - totais(gastosDoMes(m)).totalLiquido), 0);
  }

  function resumoMensal(mesReferencia) {
    const lista = gastosDoMes(mesReferencia);
    const t = totais(lista);
    const receitaLancada = receitaDoMes(mesReferencia);
    const saldoAnterior = saldoAcumuladoAntesDe(mesReferencia);
    // Receita "efetiva" do mês = o que foi lançado + o que sobrou/faltou antes.
    const receitaComSaldo = receitaLancada + saldoAnterior;
    return {
      mesReferencia,
      receita: receitaLancada,          // só o que foi lançado no mês
      saldoAnterior,                    // carregado de meses anteriores (+/−)
      receitaComSaldo,                  // receita efetiva (lançada + saldo anterior)
      despesasTotais: t.totalBruto,
      totalAposDescontos: t.totalLiquido,
      totalPago: t.totalPago,
      totalPendente: t.totalPendente,
      percentPago: t.percentPago,
      saldo: receitaComSaldo - t.totalLiquido,   // saldo corrente ao fim do mês (caixa acumulado)
      saldoDoMes: receitaLancada - t.totalLiquido, // resultado SÓ deste mês (sem carryover)
      // "Renda comprometida" continua sobre a renda REAL lançada (o saldo
      // acumulado é dinheiro guardado, não renda nova).
      percentRendaComprometida: receitaLancada > 0 ? (t.totalLiquido / receitaLancada) * 100 : null,
      // Taxa de poupança: quanto da receita efetiva sobrou (saldo/receita).
      taxaPoupanca: receitaComSaldo > 0 ? ((receitaComSaldo - t.totalLiquido) / receitaComSaldo) * 100 : null,
      quantidade: t.quantidade,
    };
  }

  // Média da despesa líquida dos N meses ANTERIORES a mesReferencia (só conta
  // meses que tiveram algum gasto lançado, pra não diluir com meses vazios).
  function mediaDespesasMesesAnteriores(mesReferencia, n) {
    const valores = [];
    for (let i = 1; i <= (n || 3); i++) {
      const m = utils.addMonths(mesReferencia, -i);
      const lista = gastosDoMes(m);
      if (lista.length) valores.push(totais(lista).totalLiquido);
    }
    if (!valores.length) return null;
    return utils.sum(valores, (v) => v) / valores.length;
  }

  function resumoAnual(ano) {
    const lista = gastosDoAno(ano);
    const t = totais(lista);
    const receitaAnual = utils.sum(
      data.receitas.filter((r) => utils.yearFromMonthRef(r.mesReferencia) === ano),
      (r) => r.valor
    );
    return {
      ano,
      receitaAnual,
      despesaAnual: t.totalLiquido,
      totalPago: t.totalPago,
      percentPago: t.percentPago,
      percentRendaComprometida: receitaAnual > 0 ? (t.totalLiquido / receitaAnual) * 100 : null,
    };
  }

  function variacaoMesAnterior(mesReferencia) {
    const anterior = utils.addMonths(mesReferencia, -1);
    const atual = totais(gastosDoMes(mesReferencia)).totalLiquido;
    const passado = totais(gastosDoMes(anterior)).totalLiquido;
    // Sem base de comparação (mês anterior sem gastos lançados) — não há
    // variação percentual significativa para mostrar.
    if (passado === 0) return null;
    return ((atual - passado) / passado) * 100;
  }

  // Série de `meses` (padrão 12) para o gráfico de evolução. A janela termina
  // no MAIS TARDE entre o mês selecionado e o último mês que já tem dados —
  // assim, se há lançamentos em meses futuros (ex.: contas/receitas já
  // programadas), a curva aparece sem o usuário precisar avançar o filtro.
  function evolucaoMensal(mesReferencia, meses) {
    const qtd = meses || 12;
    // Ancora no último mês com GASTOS lançados (dado real), não em receitas —
    // que podem estar projetadas muito à frente e "esticariam" o gráfico.
    const mesesGasto = data.gastos.map((g) => g.mesReferencia).filter(Boolean);
    const ultimoComDados = mesesGasto.length ? mesesGasto.slice().sort().pop() : mesReferencia;
    // fim = o maior (mais recente) entre o mês selecionado e o último com dados
    const fim = mesReferencia > ultimoComDados ? mesReferencia : ultimoComDados;
    const labels = utils.last12Months(fim).slice(-1 * qtd);
    return {
      labels,
      receitas: labels.map((m) => receitaDoMes(m)),
      despesas: labels.map((m) => totais(gastosDoMes(m)).totalLiquido),
    };
  }

  function topCategorias(lista, limite) {
    return gastosPorCategoria(lista).slice(0, limite || 5);
  }

  // Soma do gasto líquido por categoria no mês, só até um dia de corte (usa o
  // dia do vencimento). Permite comparar "o que já comprometi até o dia X".
  function gastoPorCategoriaAteDia(mesReferencia, diaCorte) {
    const mapa = new Map();
    gastosDoMes(mesReferencia).forEach((g) => {
      const dia = Number((g.vencimento || '').slice(8, 10)) || 31;
      if (dia <= diaCorte) mapa.set(g.categoriaId, (mapa.get(g.categoriaId) || 0) + valorLiquido(g));
    });
    return mapa;
  }

  // Gera "insights" (frases curtas) pro Painel: compara o gasto por categoria
  // do mês (até o dia de hoje, se for o mês corrente) com a média dos últimos
  // 3 meses no mesmo período, além de elogios/alertas gerais. Devolve uma lista
  // de { tom: 'good'|'warning'|'info', texto }, já priorizada e limitada.
  function gerarInsights(mesReferencia) {
    const insights = [];
    const ehMesAtual = mesReferencia === utils.currentMonthRef();
    const diaCorte = ehMesAtual ? Number(utils.todayISO().slice(8, 10)) : 31;
    const sufixoPeriodo = ehMesAtual ? ` (até o dia ${diaCorte})` : '';

    // Alertas gerais primeiro (mais acionáveis).
    const r = resumoMensal(mesReferencia);
    if (r.saldoDoMes < 0) {
      insights.push({ tom: 'warning', texto: `Atenção: neste mês as despesas já passaram a receita lançada em ${utils.formatCurrency(-r.saldoDoMes)}.` });
    }
    orcamentoStatusDoMes(mesReferencia).filter((o) => o.estourou).slice(0, 1).forEach((o) => {
      insights.push({ tom: 'warning', texto: `${o.nome} estourou o orçamento do mês (${utils.formatCurrency(o.gasto)} de ${utils.formatCurrency(o.limite)}).` });
    });

    // Comparação por categoria vs média dos 3 meses anteriores (mesmo período).
    let mesesBase = 0;
    for (let i = 1; i <= 3; i++) if (gastosDoMes(utils.addMonths(mesReferencia, -i)).length) mesesBase++;
    if (mesesBase > 0) {
      const atual = gastoPorCategoriaAteDia(mesReferencia, diaCorte);
      const somaAnterior = new Map();
      for (let i = 1; i <= 3; i++) {
        gastoPorCategoriaAteDia(utils.addMonths(mesReferencia, -i), diaCorte)
          .forEach((v, cat) => somaAnterior.set(cat, (somaAnterior.get(cat) || 0) + v));
      }
      const comparacoes = [];
      const categoriasEnvolvidas = new Set([...atual.keys(), ...somaAnterior.keys()]);
      categoriasEnvolvidas.forEach((cat) => {
        const valorAtual = atual.get(cat) || 0;
        const media = (somaAnterior.get(cat) || 0) / mesesBase;
        if (media < 50 && valorAtual < 50) return; // ignora valores pequenos (ruído)
        const delta = valorAtual - media;
        const pct = media > 0 ? (delta / media) * 100 : (valorAtual > 0 ? 100 : 0);
        if (Math.abs(delta) >= 30 && Math.abs(pct) >= 20) {
          comparacoes.push({ cat, nome: categoriaNome(cat), delta, pct });
        }
      });
      comparacoes.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
      comparacoes.slice(0, 2).forEach((c) => {
        if (c.delta > 0) {
          insights.push({ tom: 'warning', texto: `Você está gastando ${utils.formatPercent(Math.abs(c.pct), 0)} a mais em ${c.nome} que a média dos últimos meses${sufixoPeriodo}.` });
        } else {
          insights.push({ tom: 'good', texto: `Parabéns! Você gastou ${utils.formatPercent(Math.abs(c.pct), 0)} a menos em ${c.nome} que a média dos últimos meses${sufixoPeriodo}.` });
        }
      });
    }

    // Elogio de poupança e aviso de vencimentos próximos.
    if (r.taxaPoupanca != null && r.taxaPoupanca >= 20 && r.saldoDoMes >= 0) {
      insights.push({ tom: 'good', texto: `Você está poupando ${utils.formatPercent(r.taxaPoupanca, 0)} da sua receita este mês. 👏` });
    }
    if (ehMesAtual) {
      const proximos = proximosVencimentos(7);
      const totalProximos = utils.sum(proximos, valorLiquido);
      if (totalProximos > 0) {
        insights.push({ tom: 'info', texto: `Você tem ${utils.formatCurrency(totalProximos)} vencendo nos próximos 7 dias (${proximos.length} conta${proximos.length === 1 ? '' : 's'}).` });
      }
    }

    return insights.slice(0, 4);
  }

  function notasFiscaisDoAno(ano) {
    const lista = data.notasFiscais.filter((n) => utils.yearFromMonthRef(n.mesEmissao) === ano);
    return {
      quantidade: lista.length,
      total: utils.sum(lista, (n) => n.valor),
    };
  }

  function anosDisponiveis() {
    const anos = new Set([utils.currentYear()]);
    data.gastos.forEach((g) => anos.add(utils.yearFromMonthRef(g.mesReferencia)));
    data.receitas.forEach((r) => anos.add(utils.yearFromMonthRef(r.mesReferencia)));
    data.notasFiscais.forEach((n) => anos.add(utils.yearFromMonthRef(n.mesEmissao)));
    return Array.from(anos).filter(Boolean).sort((a, b) => b - a);
  }

  return {
    init, getData, getUI, setUI, subscribe, replaceData, resetAll, getTema, setTema,
    getMeiConfig, setMeiConfig, limiteMeiDoAno,
    listCategorias, categoriaNome, addCategoria, listCartoes, addCartao,
    addGasto, addGastosLote, updateGasto, deleteGasto, marcarGastoPago, marcarGastoPendente,
    addReceita, updateReceita, deleteReceita, receitaDoMes,
    addNotaFiscal, updateNotaFiscal, deleteNotaFiscal,
    getOrcamentos, setOrcamento, setOrcamentosEmLote, orcamentoStatusDoMes,
    getFiltros, setFiltro, limparFiltros, statusEfetivo, gastosFiltrados,
    valorLiquido, gastosDoMes, gastosDoAno, totais, gastosPorCategoria,
    comparativoFixoVariavel, gastosAtrasados, proximosVencimentos,
    resumoMensal, resumoAnual, variacaoMesAnterior, mediaDespesasMesesAnteriores, evolucaoMensal,
    topCategorias, notasFiscaisDoAno, anosDisponiveis, gerarInsights,
  };
})();
