/*
 * Sistema de ícones — um único set de linha (outline), 24x24, mesma espessura
 * de traço, desenhado com currentColor pra herdar a cor do texto/tema (claro,
 * escuro e oceano) sem precisar de arquivos externos ou biblioteca.
 *
 * Uso:
 *   App.icons.get('wallet')                  -> string com o <svg>
 *   App.icons.get('trash', { cls: 'x' })     -> adiciona classe extra
 *   App.icons.forCategoria('Alimentação')    -> resolve categoria -> ícone
 *
 * Cada entrada em ICONS é só o "miolo" do SVG (paths/linhas); o get() embrulha
 * com o <svg> padrão, garantindo espessura e tamanho iguais em todo o app.
 */
window.App = window.App || {};

App.icons = (function () {
  const ICONS = {
    // Navegação
    grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
    list: '<line x1="8" y1="6" x2="20" y2="6"/><line x1="8" y1="12" x2="20" y2="12"/><line x1="8" y1="18" x2="20" y2="18"/><circle cx="4" cy="6" r="1"/><circle cx="4" cy="12" r="1"/><circle cx="4" cy="18" r="1"/>',
    'file-text': '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><polyline points="14 3 14 8 19 8"/><line x1="8.5" y1="13" x2="15.5" y2="13"/><line x1="8.5" y1="17" x2="13" y2="17"/>',
    'bar-chart': '<path d="M4 4v16h16"/><rect x="7.5" y="11" width="3" height="6" rx="0.8"/><rect x="12.5" y="7" width="3" height="10" rx="0.8"/><rect x="17" y="13" width="3" height="4" rx="0.8"/>',

    // Indicadores do dashboard
    wallet: '<path d="M19 8V6.5A1.5 1.5 0 0 0 17.5 5H5.5A1.5 1.5 0 0 0 4 6.5v11A1.5 1.5 0 0 0 5.5 19h12a1.5 1.5 0 0 0 1.5-1.5V16"/><path d="M20.5 8H15a2 2 0 0 0-2 2v2a2 2 0 0 0 2 2h5.5a.5.5 0 0 0 .5-.5v-7a.5.5 0 0 0-.5-.5z"/><circle cx="16" cy="12" r="0.9" fill="currentColor" stroke="none"/>',
    'trending-up': '<polyline points="3 17 9 11 13 15 21 7"/><polyline points="15 7 21 7 21 13"/>',
    'trending-down': '<polyline points="3 7 9 13 13 9 21 17"/><polyline points="15 17 21 17 21 11"/>',
    'check-circle': '<circle cx="12" cy="12" r="9"/><polyline points="8.5 12.5 11 15 15.5 9.5"/>',
    clock: '<circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 16 14"/>',
    'alert-triangle': '<path d="M12 4 3 19h18z"/><line x1="12" y1="10" x2="12" y2="14"/><circle cx="12" cy="16.5" r="0.6" fill="currentColor" stroke="none"/>',
    calendar: '<rect x="4" y="5" width="16" height="16" rx="2"/><line x1="4" y1="9" x2="20" y2="9"/><line x1="9" y1="3" x2="9" y2="6"/><line x1="15" y1="3" x2="15" y2="6"/>',
    gauge: '<path d="M4 15a8 8 0 0 1 16 0"/><line x1="12" y1="15" x2="15.5" y2="11.5"/><circle cx="12" cy="15" r="1"/>',
    activity: '<polyline points="3 12 8 12 10.5 5 14 19 16.5 12 21 12"/>',

    // Ações
    plus: '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
    check: '<polyline points="4 12.5 9 17.5 20 6.5"/>',
    pencil: '<path d="M4 20h4L18.5 9.5a2 2 0 0 0 0-3l-1-1a2 2 0 0 0-3 0L4 16z"/><line x1="13.5" y1="7.5" x2="16.5" y2="10.5"/>',
    trash: '<polyline points="4 7 20 7"/><path d="M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12"/><path d="M9.5 7V5a1.5 1.5 0 0 1 1.5-1.5h2A1.5 1.5 0 0 1 14.5 5v2"/><line x1="10" y1="11" x2="10" y2="16.5"/><line x1="14" y1="11" x2="14" y2="16.5"/>',
    undo: '<path d="M9 5 4 9.5 9 14"/><path d="M4 9.5h9a6 6 0 0 1 0 12h-2.5"/>',
    funnel: '<path d="M4 5h16l-6 7.5V19l-4 2v-8.5z"/>',
    download: '<path d="M12 4v10"/><polyline points="8 11 12 15 16 11"/><path d="M5 19h14"/>',
    upload: '<path d="M12 16V5"/><polyline points="8 9 12 5 16 9"/><path d="M5 19h14"/>',
    search: '<circle cx="11" cy="11" r="6"/><line x1="15.5" y1="15.5" x2="20" y2="20"/>',
    x: '<line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/>',
    'chevron-left': '<polyline points="14 6 8 12 14 18"/>',
    'chevron-right': '<polyline points="10 6 16 12 10 18"/>',

    // Temas
    sun: '<circle cx="12" cy="12" r="4.2"/><line x1="12" y1="2.5" x2="12" y2="5"/><line x1="12" y1="19" x2="12" y2="21.5"/><line x1="2.5" y1="12" x2="5" y2="12"/><line x1="19" y1="12" x2="21.5" y2="12"/><line x1="5.6" y1="5.6" x2="7.3" y2="7.3"/><line x1="16.7" y1="16.7" x2="18.4" y2="18.4"/><line x1="5.6" y1="18.4" x2="7.3" y2="16.7"/><line x1="16.7" y1="7.3" x2="18.4" y2="5.6"/>',
    moon: '<path d="M20 14.5A8 8 0 0 1 9.5 4 7 7 0 1 0 20 14.5z"/>',
    waves: '<path d="M3 7q3 -3 6 0t6 0 6 0"/><path d="M3 12q3 -3 6 0t6 0 6 0"/><path d="M3 17q3 -3 6 0t6 0 6 0"/>',
    contrast: '<circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 0 1 0 18z" fill="currentColor" stroke="none"/>',
    // Portal (referência ao Rick and Morty) — espiral concêntrica.
    portal: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5.5"/><circle cx="12" cy="12" r="2"/>',
    // Estrela da Morte (Star Wars) — esfera + prato do superlaser + trincheira.
    'death-star': '<circle cx="12" cy="12" r="9"/><circle cx="15.6" cy="8.4" r="2.2"/><line x1="3.2" y1="12.6" x2="20.8" y2="12.6"/>',

    // Categorias
    'cat-alimentacao': '<path d="M6 12v9"/><path d="M4.5 3v3a1.5 1.5 0 0 0 3 0V3"/><path d="M6 6v6"/><path d="M16.6 3c-1.3 1.9-1.6 5.1-1.6 7.2 0 1.2.8 2 1.9 2"/><path d="M16.9 12.2V21"/>',
    'cat-transporte': '<path d="M5 11l1.4-4A2 2 0 0 1 8.3 5.6h7.4a2 2 0 0 1 1.9 1.4L19 11"/><path d="M4 11h16a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-4a1 1 0 0 1 1-1z"/><circle cx="7.5" cy="16.8" r="1.3"/><circle cx="16.5" cy="16.8" r="1.3"/>',
    'cat-compras': '<path d="M6 8h12l-1 12a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>',
    'cat-tributo': '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="9" y1="12" x2="15" y2="12"/>',
    'cat-emprestimo': '<rect x="3" y="7" width="18" height="10" rx="2"/><circle cx="12" cy="12" r="2.5"/><line x1="6" y1="10.5" x2="6" y2="13.5"/><line x1="18" y1="10.5" x2="18" y2="13.5"/>',
    'cat-financiamento': '<line x1="3" y1="21" x2="21" y2="21"/><path d="M5 21V11M9.7 21V11M14.3 21V11M19 21V11"/><path d="M3.5 11 12 4.5 20.5 11z"/>',
    'cat-cartao': '<rect x="3" y="6" width="18" height="12" rx="2"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="7" y1="14.5" x2="11" y2="14.5"/>',
    'cat-fornecedor': '<rect x="3" y="7" width="11" height="9" rx="1"/><path d="M14 10h3.6l3.4 3.2V16h-7z"/><circle cx="7" cy="17.5" r="1.5"/><circle cx="17" cy="17.5" r="1.5"/>',
    'cat-academia': '<line x1="3" y1="9" x2="3" y2="15"/><line x1="6" y1="7.5" x2="6" y2="16.5"/><line x1="6" y1="12" x2="18" y2="12"/><line x1="18" y1="7.5" x2="18" y2="16.5"/><line x1="21" y1="9" x2="21" y2="15"/>',
    'cat-bem-estar': '<path d="M12 20s-7-4.5-7-9.5A3.5 3.5 0 0 1 12 8a3.5 3.5 0 0 1 7 2.5c0 5-7 9.5-7 9.5z"/>',
    'cat-energia': '<path d="M13 2 4 14h6l-1 8 9-12h-6z"/>',
    'cat-telefonia': '<path d="M2.5 8.5a15 15 0 0 1 19 0"/><path d="M5.5 12a10 10 0 0 1 13 0"/><path d="M8.5 15.5a5 5 0 0 1 7 0"/><circle cx="12" cy="19" r="0.7" fill="currentColor" stroke="none"/>',
    'cat-lazer': '<rect x="3" y="5" width="18" height="14" rx="2"/><line x1="7.5" y1="5" x2="7.5" y2="19"/><line x1="16.5" y1="5" x2="16.5" y2="19"/><line x1="3" y1="12" x2="21" y2="12"/>',
    'cat-games': '<rect x="2" y="7" width="20" height="10" rx="5"/><line x1="6.5" y1="12" x2="9.5" y2="12"/><line x1="8" y1="10.5" x2="8" y2="13.5"/><circle cx="15.5" cy="10.8" r="0.9" fill="currentColor" stroke="none"/><circle cx="17.8" cy="13.2" r="0.9" fill="currentColor" stroke="none"/>',
    'cat-default': '<path d="M4 4h7l9 9-7 7-9-9z"/><circle cx="8.5" cy="8.5" r="1.3"/>',
  };

  // Palavras-chave -> ícone de categoria. Comparação sem acento e minúscula,
  // então funciona com as variações que o usuário possa cadastrar.
  const CATEGORIA_REGRAS = [
    [/aliment|comida|restaurante|mercado|super/, 'cat-alimentacao'],
    [/transp|combust|posto|uber|onibus|passagem/, 'cat-transporte'],
    [/compra|loja|shopping/, 'cat-compras'],
    [/tribut|imposto|taxa|mei|das/, 'cat-tributo'],
    [/emprest|financeira|credito pessoal/, 'cat-emprestimo'],
    [/financ|parcela|prestacao/, 'cat-financiamento'],
    [/cartao|fatura/, 'cat-cartao'],
    [/fornecedor|pagament/, 'cat-fornecedor'],
    [/academ|gym|treino|crossfit/, 'cat-academia'],
    [/bem|estar|saude|beleza|estetica/, 'cat-bem-estar'],
    [/energ|luz|eletric/, 'cat-energia'],
    [/telefon|internet|celular|tv|streaming/, 'cat-telefonia'],
    [/lazer|cinema|passeio|viagem/, 'cat-lazer'],
    [/game|jogo|nintendo|steam|playstation|xbox/, 'cat-games'],
  ];

  function normalizar(texto) {
    return (texto || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(new RegExp('[\\u0300-\\u036f]', 'g'), ''); // remove acentos combinantes
  }

  function nomeIconeCategoria(nomeCategoria) {
    const alvo = normalizar(nomeCategoria);
    for (const [regex, icone] of CATEGORIA_REGRAS) {
      if (regex.test(alvo)) return icone;
    }
    return 'cat-default';
  }

  function get(nome, opts) {
    opts = opts || {};
    const corpo = ICONS[nome] || ICONS['cat-default'];
    const cls = `icon${opts.cls ? ' ' + opts.cls : ''}`;
    return `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${corpo}</svg>`;
  }

  function forCategoria(nomeCategoria, opts) {
    return get(nomeIconeCategoria(nomeCategoria), opts);
  }

  return { get, forCategoria, nomeIconeCategoria };
})();
