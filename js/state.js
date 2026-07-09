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
  // Gastos
  // ---------------------------------------------------------------------

  function addGasto(gasto) {
    const novo = Object.assign({ id: utils.uuid(), desconto: 0 }, gasto);
    data.gastos.push(novo);
    persist();
    notify();
    return novo;
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
  // Seletores / indicadores (usados pelo Dashboard e Consolidado)
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

  function resumoMensal(mesReferencia) {
    const lista = gastosDoMes(mesReferencia);
    const t = totais(lista);
    const receita = receitaDoMes(mesReferencia);
    return {
      mesReferencia,
      receita,
      despesasTotais: t.totalBruto,
      totalAposDescontos: t.totalLiquido,
      totalPago: t.totalPago,
      totalPendente: t.totalPendente,
      percentPago: t.percentPago,
      saldo: receita - t.totalLiquido,
      percentRendaComprometida: receita > 0 ? (t.totalLiquido / receita) * 100 : null,
      quantidade: t.quantidade,
    };
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

  // Série dos últimos `meses` (padrão 12) meses terminando em mesReferencia.
  function evolucaoMensal(mesReferencia, meses) {
    const labels = utils.last12Months(mesReferencia).slice(-1 * (meses || 12));
    return {
      labels,
      receitas: labels.map((m) => receitaDoMes(m)),
      despesas: labels.map((m) => totais(gastosDoMes(m)).totalLiquido),
    };
  }

  function topCategorias(lista, limite) {
    return gastosPorCategoria(lista).slice(0, limite || 5);
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
    listCategorias, categoriaNome, addCategoria,
    addGasto, updateGasto, deleteGasto, marcarGastoPago, marcarGastoPendente,
    addReceita, updateReceita, deleteReceita, receitaDoMes,
    addNotaFiscal, updateNotaFiscal, deleteNotaFiscal,
    getFiltros, setFiltro, limparFiltros, statusEfetivo, gastosFiltrados,
    valorLiquido, gastosDoMes, gastosDoAno, totais, gastosPorCategoria,
    comparativoFixoVariavel, gastosAtrasados, proximosVencimentos,
    resumoMensal, resumoAnual, variacaoMesAnterior, evolucaoMensal,
    topCategorias, notasFiscaisDoAno, anosDisponiveis,
  };
})();
