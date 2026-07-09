/*
 * Camada de persistência. Tudo é guardado em uma única chave do localStorage,
 * como um JSON só — simples de inspecionar, exportar e importar.
 *
 * Formato gravado (App.storage.load() sempre devolve algo nesse formato):
 * {
 *   version: 1,
 *   categorias:    [{ id, nome }],
 *   gastos:        [{ id, descricao, categoriaId, tipo, valor, desconto,
 *                      vencimento, status, dataPagamento, mesReferencia, observacao }],
 *   receitas:      [{ id, mesReferencia, valor, observacao }],
 *   notasFiscais:  [{ id, mesEmissao, dataEmissao, numero, valor }],
 *   preferencias:  { tema: 'sistema' | 'claro' | 'escuro' },
 * }
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
      preferencias: { tema: 'sistema' },
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
      preferencias: Object.assign({ tema: 'sistema' }, data.preferencias),
    };
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

  return { load, save, resetAll, exportToFile, importFromFile, CATEGORIAS_PADRAO };
})();
