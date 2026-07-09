/*
 * Pequenas animações de número (efeito "contador" quando um valor muda de
 * um card pro outro). Guardamos o último valor mostrado de cada métrica
 * (por uma chave estável, ex.: "dashboard:saldo") para animar a partir dele
 * na próxima renderização — assim trocar de mês, marcar um gasto como pago
 * etc. faz o número "andar" até o novo valor em vez de só trocar de texto.
 */
window.App = window.App || {};

App.animate = (function () {
  const ultimoValor = new Map();

  function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
  }

  // el: elemento cujo textContent será animado
  // chave: identificador estável da métrica (ex.: "dashboard:saldo-2026-07")
  // valorFinal: número alvo
  // formatar: função (número) => texto exibido
  function countUp(el, chave, valorFinal, formatar, duracaoMs) {
    if (!el || !isFinite(valorFinal)) return;
    const duracao = duracaoMs || 600;
    const valorInicial = ultimoValor.has(chave) ? ultimoValor.get(chave) : 0;
    ultimoValor.set(chave, valorFinal);

    if (valorInicial === valorFinal) {
      el.textContent = formatar(valorFinal);
      return;
    }

    const inicio = performance.now();
    function passo(agora) {
      const t = Math.min(1, (agora - inicio) / duracao);
      const valorAtual = valorInicial + (valorFinal - valorInicial) * easeOutCubic(t);
      el.textContent = formatar(valorAtual);
      if (t < 1) requestAnimationFrame(passo);
      else el.textContent = formatar(valorFinal);
    }
    requestAnimationFrame(passo);
  }

  // Anima todo elemento com data-countup="chave" data-value="123.45" dentro
  // de um container recém-renderizado. data-fmt escolhe o formato de saída.
  function wireCountUps(container) {
    container.querySelectorAll('[data-countup]').forEach((el) => {
      const chave = el.dataset.countup;
      const valor = Number(el.dataset.value);
      const formatar = el.dataset.fmt === 'percent'
        ? (v) => App.utils.formatPercent(v, 0)
        : App.utils.formatCurrency;
      countUp(el, chave, valor, formatar);
    });
  }

  return { countUp, wireCountUps };
})();
