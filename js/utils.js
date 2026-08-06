/*
 * Funções utilitárias puras (formatação, datas, ids) usadas por toda a aplicação.
 * Nenhum arquivo aqui depende de outro — pode ser lido isoladamente.
 */
window.App = window.App || {};

App.utils = (function () {
  const currencyFormatter = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
  const dateFormatter = new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC' });

  // Teto anual de faturamento do MEI (R$ 81.000 desde 2018). Se o governo
  // reajustar, é só mudar este valor. Usado no card de Controle MEI.
  const LIMITE_MEI_ANUAL = 81000;

  function pad(n) {
    return String(n).padStart(2, '0');
  }

  function capitalize(str) {
    return str ? str.charAt(0).toUpperCase() + str.slice(1) : str;
  }

  function formatCurrency(value) {
    return currencyFormatter.format(Number(value) || 0);
  }

  function formatPercent(value, digits) {
    if (value == null || !isFinite(value)) return '—';
    return `${value.toFixed(digits == null ? 0 : digits)}%`;
  }

  // Datas de negócio são sempre strings "YYYY-MM-DD". Construímos o Date em
  // UTC para não sofrer o deslocamento de fuso horário do construtor nativo
  // (new Date("2026-07-08") é interpretado como meia-noite UTC, e formatar em
  // horário local pode "voltar" um dia — por isso lemos e formatamos tudo em UTC).
  function parseISODate(isoDate) {
    if (!isoDate) return null;
    const [y, m, d] = isoDate.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d));
  }

  function formatDate(isoDate) {
    const date = parseISODate(isoDate);
    return date ? dateFormatter.format(date) : '—';
  }

  function todayISO() {
    const now = new Date();
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  }

  function currentMonthRef() {
    const now = new Date();
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}`;
  }

  function currentYear() {
    return new Date().getFullYear();
  }

  // "2026-07" -> "Julho de 2026"
  function monthRefToLabel(monthRef) {
    if (!monthRef) return '—';
    const [y, m] = monthRef.split('-').map(Number);
    const date = new Date(Date.UTC(y, m - 1, 1));
    const label = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(date);
    return capitalize(label);
  }

  // "2026-07" -> "Jul/26"
  function monthRefToShortLabel(monthRef) {
    const [y, m] = monthRef.split('-').map(Number);
    const date = new Date(Date.UTC(y, m - 1, 1));
    const label = new Intl.DateTimeFormat('pt-BR', { month: 'short', timeZone: 'UTC' }).format(date).replace('.', '');
    return `${capitalize(label)}/${String(y).slice(2)}`;
  }

  function addMonths(monthRef, delta) {
    const [y, m] = monthRef.split('-').map(Number);
    const date = new Date(Date.UTC(y, m - 1 + delta, 1));
    return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}`;
  }

  function monthRefFromDate(isoDate) {
    return isoDate ? isoDate.slice(0, 7) : null;
  }

  function yearFromMonthRef(monthRef) {
    return monthRef ? Number(monthRef.slice(0, 4)) : null;
  }

  // Lista de 12 mesesRef terminando em referenceMonthRef, em ordem crescente.
  function last12Months(referenceMonthRef) {
    const months = [];
    for (let i = 11; i >= 0; i--) months.push(addMonths(referenceMonthRef, -i));
    return months;
  }

  function uuid() {
    if (window.crypto && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
    return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
  }

  // Escapa texto vindo do usuário antes de interpolar em template strings de HTML.
  function escapeHtml(value) {
    if (value == null) return '';
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function isOverdue(gasto, referenceISODate) {
    const ref = referenceISODate || todayISO();
    return gasto.status === 'pendente' && gasto.vencimento < ref;
  }

  function ultimoDiaDoMes(y, mIndex0) {
    return new Date(Date.UTC(y, mIndex0 + 1, 0)).getUTCDate();
  }

  // Dado o dia da compra e os dias de FECHAMENTO e VENCIMENTO do cartão,
  // descobre em qual fatura a compra cai. Regra:
  //  - Compra até o dia do fechamento entra na fatura que fecha neste mês;
  //    depois do fechamento, entra na fatura do mês seguinte.
  //  - A fatura vence no dia de vencimento; se o vencimento é ANTES do
  //    fechamento (ex.: fecha dia 28, vence dia 7), o pagamento cai no mês
  //    seguinte ao fechamento.
  // O "mesRef" devolvido é o mês em que a fatura é PAGA (mês subsequente à
  // compra, na prática) — é ele que agrupa a fatura e onde o gasto pesa no
  // caixa. Devolve null se o cartão ainda não tem os dias configurados.
  function calcularFatura(dataCompraISO, diaFechamento, diaVencimento) {
    const F = Number(diaFechamento);
    const V = Number(diaVencimento);
    if (!dataCompraISO || !F || !V) return null;
    const [y, m, d] = dataCompraISO.split('-').map(Number);
    let fY = y; let fM = m; // mês (1-based) do fechamento que captura a compra
    if (d > F) { fM += 1; if (fM > 12) { fM = 1; fY += 1; } }
    let dY = fY; let dM = fM; // mês do vencimento
    if (V < F) { dM += 1; if (dM > 12) { dM = 1; dY += 1; } }
    const mesRef = `${dY}-${pad(dM)}`;
    return { mesRef, vencimentoISO: faturaVencimentoISO(mesRef, V) };
  }

  // Data de vencimento (ISO) de uma fatura, dado o mês da fatura e o dia de
  // vencimento do cartão. Ajusta para o último dia do mês quando o dia não
  // existe (ex.: vencimento 31 em fevereiro).
  function faturaVencimentoISO(mesRef, diaVencimento) {
    const V = Number(diaVencimento);
    if (!mesRef || !V) return null;
    const [y, m] = mesRef.split('-').map(Number);
    const dia = Math.min(V, ultimoDiaDoMes(y, m - 1));
    return `${mesRef}-${pad(dia)}`;
  }

  function daysUntil(isoDate, referenceISODate) {
    const ref = parseISODate(referenceISODate || todayISO());
    const target = parseISODate(isoDate);
    if (!target || !ref) return null;
    return Math.round((target - ref) / 86400000);
  }

  function sum(list, mapFn) {
    return list.reduce((acc, item) => acc + (Number(mapFn(item)) || 0), 0);
  }

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function statusLabel(status) {
    return { pago: 'Pago', pendente: 'Pendente', atrasado: 'Atrasado' }[status] || status;
  }

  return {
    formatCurrency, formatPercent, formatDate, parseISODate, todayISO,
    currentMonthRef, currentYear, monthRefToLabel, monthRefToShortLabel,
    addMonths, monthRefFromDate, yearFromMonthRef, last12Months, uuid,
    calcularFatura, faturaVencimentoISO,
    escapeHtml, isOverdue, daysUntil, sum, clamp, pad, capitalize, statusLabel,
    LIMITE_MEI_ANUAL,
  };
})();
