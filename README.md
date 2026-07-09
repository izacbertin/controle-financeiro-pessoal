# Controle Financeiro Pessoal

App de página única para controle financeiro pessoal — substitui a planilha do
Numbers com Gastos, Receitas, Notas Fiscais e um Consolidado calculado
automaticamente. 100% front-end: sem servidor, sem login, sem serviço pago.
Os dados ficam salvos **no navegador de cada pessoa** (localStorage).

## Como abrir

**Opção 1 — mais simples:** dê duplo clique em `index.html`. Funciona na
maioria dos navegadores.

**Opção 2 — recomendada:** rode um servidor local bem simples dentro da pasta
do projeto (evita qualquer restrição que o navegador imponha a arquivos
abertos com `file://`, e é assim que o app foi testado):

```bash
cd controle-financeiro-pessoal
python3 -m http.server 8080
# depois abra http://localhost:8080 no navegador
```

Qualquer outro servidor estático simples serve (ex.: `npx serve`, extensão
"Live Server" do VS Code etc.) — não há build, não há dependências para
instalar.

## Estrutura do projeto

```
controle-financeiro-pessoal/
├── index.html              # esqueleto da página + ordem de carregamento dos scripts
├── css/
│   └── styles.css          # design system (cores, tema claro/escuro, layout, componentes)
└── js/
    ├── utils.js             # formatação (R$, datas), ids, helpers de mês/ano — sem dependências
    ├── storage.js            # leitura/escrita no localStorage + exportar/importar/zerar backup
    ├── state.js               # estado central: dados carregados, filtros, CRUD, cálculos (dashboard/consolidado)
    ├── charts.js               # gráficos "artesanais" (barras horizontais e linha), sem biblioteca externa
    ├── components/
    │   ├── modal.js              # modal genérico usado pelos formulários
    │   └── toast.js              # aviso curto no rodapé da tela
    ├── views/
    │   ├── dashboard.js           # Painel: indicadores + gráficos do mês selecionado
    │   ├── gastos.js               # CRUD de gastos + filtros combináveis
    │   ├── receitas.js              # CRUD de receitas por mês de referência
    │   ├── nfs.js                    # CRUD de notas fiscais emitidas
    │   └── consolidado.js             # tela somente leitura, mensal e anual
    └── app.js                   # bootstrap: navegação, tema, ações globais (carregado por último)
```

Não há bundler nem framework. Cada view é um objeto com um método
`render(container)` que desenha seu HTML e liga seus próprios eventos —
simples de seguir e de mexer sem precisar entender uma ferramenta de build.

## Onde ficam os dados

Tudo é gravado em **uma única chave do localStorage**
(`controleFinanceiroPessoal:v1`), como um JSON. Isso significa:

- Os dados são **por navegador e por computador/celular** — não sincronizam
  sozinhos entre dispositivos.
- Limpar o histórico/dados de navegação do navegador apaga os dados do app.
- Para levar os dados de um lugar para o outro (ou fazer um backup de
  verdade), use **Exportar backup** (baixa um `.json`) e **Importar backup**
  (lê um `.json` exportado antes) — botões no rodapé do menu lateral.
- **Zerar dados** apaga tudo neste navegador. Use antes de repassar o
  projeto (a pasta) para outra pessoa usar com os dados dela, ou para
  recomeçar do zero.

## Decisões que valem a pena revisar

- **Categoria por gasto:** a lista inicial vem com as categorias citadas no
  pedido, mas o cadastro é livre — no formulário de gasto, escolha
  "+ Nova categoria…" para criar uma na hora.
- **Cor por categoria nos gráficos:** os gráficos de barra mostram até 7
  categorias com cor própria e agrupam o restante em "Outras" — isso é
  intencional (ver `js/charts.js`): com um número de categorias que só
  cresce, uma cor fixa por categoria deixaria de ser distinguível depois de
  um tempo. A ordenação (maior valor primeiro) já cumpre o papel de
  "top categorias".
- **"Total após descontos" no Consolidado:** o pedido original citava esse
  número mas a planilha não tinha um campo de desconto explícito. Adicionei
  um campo opcional **Desconto (R$)** no formulário de gasto (padrão zero) —
  o Consolidado usa `valor − desconto` em todos os totais "líquidos". Se não
  fizer sentido, é só ignorar o campo (deixe em branco) que o comportamento
  fica idêntico a não ter desconto algum.
- **Receita por mês:** é possível lançar mais de uma receita no mesmo mês de
  referência (ex.: faturamento fixo + um extra) — o Consolidado soma tudo o
  que estiver no mesmo mês.
- **Atrasados / próximos vencimentos** (Painel) olham *todos* os gastos
  pendentes, não só os do mês selecionado no seletor — a ideia é serem um
  aviso do que precisa de atenção agora, independente do mês em foco.

## Personalizando

- **Cor de destaque:** troque `--accent` (e `--accent-wash`) no topo de
  `css/styles.css` — ela é usada em botões primários, links ativos e chips
  selecionados, tanto no claro quanto no escuro (defina os dois).
- **Categorias padrão da primeira execução:** lista `CATEGORIAS_PADRAO` em
  `js/storage.js`.
- **Cores dos gráficos:** variáveis `--chart-cat-1` a `--chart-cat-7`,
  `--chart-outras`, `--series-receita` e `--series-despesa`, também em
  `css/styles.css` (claro e escuro definidos separadamente). Foram escolhidas
  seguindo uma paleta validada para leitura por pessoas com daltonismo — se
  for trocar, vale revalidar o contraste.
- **Tema:** o botão no rodapé do menu alterna entre Automático (segue o
  sistema operacional), Claro e Escuro — fica salvo junto com os outros dados.

## Compatibilidade

Testado num navegador baseado em Chromium. Usa apenas recursos padrão de
JavaScript/CSS modernos (`localStorage`, `Intl.NumberFormat`,
`crypto.randomUUID`, CSS custom properties, `<details>`) — deve funcionar em
qualquer versão recente de Chrome, Edge, Firefox ou Safari, desktop ou
mobile.
