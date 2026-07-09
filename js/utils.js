/*
 * Funções utilitárias puras (formatação, datas, ids) usadas por toda a aplicação.
 * Nenhum arquivo aqui depende de outro — pode ser lido isoladamente.
 */
window.App = window.App || {};

App.utils = (function () {
  const currencyFormatter = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
  const dateFormatter = new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC' });

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
    escapeHtml, isOverdue, daysUntil, sum, clamp, pad, capitalize, statusLabel,
  };
})();
