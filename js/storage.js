/*
 * Camada de persistência. Tudo é guardado em uma única chave do localStorage,
 * como um JSON só — simples de inspecionar, exportar e importar.
 *
 * Formato gravado (App.storage.load() sempre devolve algo nesse formato):
 * {
 *   version: 1,
 *   categorias:    [{ id, nome }],
 *   cartoes:       [{ nome, diaFechamento, diaVencimento }],
 *   gastos:        [{ id, descricao, categoriaId, tipo, valor, desconto,
 *                      vencimento, status, dataPagamento, mesReferencia,
 *                      observacao, cartao }],
 *   receitas:      [{ id, mesReferencia, valor, observacao }],
 *   notasFiscais:  [{ id, mesEmissao, dataEmissao, numero, valor }],
 *   faturas:       { "<cartao>||<mesRef>": { pago, dataPagamento } },
 *   preferencias:  { tema: 'sistema' | 'claro' | 'escuro' },
 * }
 *
 * Gastos de cartão (com `cartao` preenchido) NÃO têm pago/pendente próprio: o
 * `mesReferencia` deles é o mês da FATURA (mês em que a fatura é paga), o
 * `vencimento` guarda a data da COMPRA, e quem controla pago/pendente é o
 * registro em `faturas` (agrupado por cartão + mês).
 */
window.App = window.App || {};

App.storage = (function () {
  const STORAGE_KEY = 'controleFinanceiroPessoal:v1';
  const CURRENT_VERSION = 1;

  // Categorias sugeridas na primeira execução. O usuário pode adicionar quantas
  // outras quiser depois — esta lista é só a semente inicial.
  const CATEGORIAS_PADRAO = [
    'Alimentação', 'Transporte', 'Compras', 'Tributo', 'Empréstimo',
    'Financiamento', 'Cartão de crédito', 'Pagamentos a fornecedor',
    'Academia', 'Bem-estar', 'Energia elétrica', 'Telefonia e internet',
    'Lazer', 'Games',
  ];

  function novoEstadoVazio() {
    return {
      version: CURRENT_VERSION,
      categorias: CATEGORIAS_PADRAO.map((nome) => ({ id: App.utils.uuid(), nome })),
      gastos: [],
      receitas: [],
      notasFiscais: [],
      // Teto de gasto mensal por categoria: { [categoriaId]: valorMensal }.
      orcamentos: {},
      // Cartões de crédito cadastrados, com os dias de fechamento/vencimento
      // usados para calcular em qual fatura cada compra cai.
      cartoes: [],
      // Estado de pagamento de cada fatura (cartão + mês), fora dos gastos.
      faturas: {},
      // tema + config do MEI (limite anual e mês de abertura p/ rateio do 1º ano)
      preferencias: { tema: 'sistema', mei: { limiteAnual: 81000, abertura: '' } },
    };
  }

  // Garante que todo campo esperado exista, mesmo que o JSON salvo/importado
  // seja de uma versão antiga ou tenha sido editado manualmente.
  function normalizar(data) {
    const base = novoEstadoVazio();
    if (!data || typeof data !== 'object') return base;
    return {
      version: CURRENT_VERSION,
      categorias: Array.isArray(data.categorias) && data.categorias.length ? data.categorias : base.categorias,
      gastos: Array.isArray(data.gastos) ? data.gastos : [],
      receitas: Array.isArray(data.receitas) ? data.receitas : [],
      notasFiscais: Array.isArray(data.notasFiscais) ? data.notasFiscais : [],
      orcamentos: (data.orcamentos && typeof data.orcamentos === 'object') ? data.orcamentos : {},
      cartoes: normalizarCartoes(data.cartoes),
      // Se o dado ainda não conhece "faturas" (backup anterior ao recurso),
      // deriva o pago/pendente das próprias compras — uma vez só. Depois de
      // salvo, a chave passa a existir e nunca mais é recalculada.
      faturas: (data.faturas && typeof data.faturas === 'object')
        ? data.faturas
        : derivarFaturasDeGastos(data.gastos),
      preferencias: normalizarPreferencias(data.preferencias),
    };
  }

  // Migração única: agrupa as compras de cartão por (cartão + mês) e marca a
  // fatura como paga quando TODAS as compras daquele grupo já estavam pagas.
  function derivarFaturasDeGastos(gastos) {
    const faturas = {};
    if (!Array.isArray(gastos)) return faturas;
    const grupos = {};
    gastos.forEach((g) => {
      if (!g || !g.cartao) return;
      const chave = `${g.cartao}||${g.mesReferencia}`;
      (grupos[chave] = grupos[chave] || []).push(g);
    });
    Object.keys(grupos).forEach((chave) => {
      const itens = grupos[chave];
      const todasPagas = itens.length > 0 && itens.every((g) => g.status === 'pago');
      if (todasPagas) {
        const dataPagamento = itens.map((g) => g.dataPagamento).filter(Boolean).sort().pop() || '';
        faturas[chave] = { pago: true, dataPagamento };
      }
    });
    return faturas;
  }

  // Cartões nasceram como uma lista de nomes (strings). Agora cada cartão é um
  // objeto { nome, diaFechamento, diaVencimento }. Migra o formato antigo sem
  // perder nada — os dias ficam nulos até o usuário configurar.
  function normalizarCartoes(cartoes) {
    if (!Array.isArray(cartoes)) return [];
    return cartoes
      .map((c) => {
        if (typeof c === 'string') return { nome: c, diaFechamento: null, diaVencimento: null };
        if (c && typeof c === 'object' && c.nome) {
          return {
            nome: c.nome,
            diaFechamento: c.diaFechamento != null ? Number(c.diaFechamento) : null,
            diaVencimento: c.diaVencimento != null ? Number(c.diaVencimento) : null,
          };
        }
        return null;
      })
      .filter(Boolean);
  }

  function normalizarPreferencias(prefs) {
    const p = Object.assign({ tema: 'sistema' }, prefs);
    p.mei = Object.assign({ limiteAnual: 81000, abertura: '' }, p.mei);
    return p;
  }

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return novoEstadoVazio();
      return normalizar(JSON.parse(raw));
    } catch (err) {
      console.error('Não foi possível ler os dados salvos, iniciando um estado novo.', err);
      return novoEstadoVazio();
    }
  }

  function save(data) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      return true;
    } catch (err) {
      console.error('Não foi possível salvar os dados (armazenamento local pode estar cheio ou bloqueado).', err);
      return false;
    }
  }

  function resetAll() {
    const fresh = novoEstadoVazio();
    save(fresh);
    return fresh;
  }

  // Baixa os dados atuais como um arquivo .json (backup manual do usuário).
  function exportToFile(data) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `controle-financeiro-backup-${App.utils.todayISO()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  // Lê um arquivo .json escolhido pelo usuário e devolve o estado normalizado.
  function importFromFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const parsed = JSON.parse(reader.result);
          resolve(normalizar(parsed));
        } catch (err) {
          reject(new Error('O arquivo selecionado não é um backup válido (JSON inválido).'));
        }
      };
      reader.onerror = () => reject(new Error('Não foi possível ler o arquivo selecionado.'));
      reader.readAsText(file);
    });
  }

  return { load, save, resetAll, exportToFile, importFromFile, normalize: normalizar, CATEGORIAS_PADRAO };
})();
