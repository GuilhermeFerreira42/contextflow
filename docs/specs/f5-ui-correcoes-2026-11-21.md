# SPEC F5-UI-C — Correções pontuais pedidas pelo proprietário (21/11/2026)

> **Status:** implementada e validada tecnicamente; homologação humana pendente.
> Origem: `Continuidade de Projeto/PEDIDO-PARA-ARENA-CORRECOES-INTERFACE.txt`.
> Referências visuais do pedido: `Continuidade de Projeto/pedido-correcao-ui-2026-11-21/`.
>
> **Limite de escopo:** correções de defeito na interface existente. Não é um
> novo redesign, não é a F6 e não altera arquitetura, contratos, banco ou
> serviços. A identidade visual atual é preservada.

## 1. Problemas relatados e causa raiz encontrada

| # | Relato | Causa raiz medida | Arquivos |
|---|---|---|---|
| 1 | A barra recolhe mas não reabre; textos cortados | O botão vivia dentro de `.marca`, com `margin-left: auto`. Recolhida, a marca tem 56 px e 28 px de padding: o botão ia para **x=49** e ficava fora da área visível (`overflow: hidden`). Só 168 px² de 576 px² estavam clicáveis, e o clique caía no `.conteudo`. Além disso, o rótulo dos itens era **texto solto** no `<button>` — impossível de esconder por CSS, daí os nomes cortados. | `index.html`, `principal.css`, `biblioteca.js` |
| 2 | Faixa vazia excessiva à direita | `.tela` tinha `max-width: 1600px` **sem** centralização: acima de ~1660 px a sobra ia toda para a direita. | `principal.css` |
| 3 | Sem controle para ajustar a altura das linhas | Não existia. A altura vinha de `--altura-linha-ampliado` fixa em 136 px. | `index.html`, `biblioteca.js`, `principal.css` |
| 4 | "Resumo" aparece mesmo desmarcado; vazio enorme entre seleção e vídeo | A coluna `resumo-estado` **não estava** na lista de `[data-coluna=…=oculta]`: desmarcar a opção não escondia nada. E `table-layout: fixed` com `min-width: 1180px` distribuía a sobra na coluna do checkbox, que ia a **218 px**. | `principal.css` |
| 5 | Transcrição numa faixa estreita, um trecho por linha | Coluna de tempo fixa de 62 px em grid de duas colunas, sem opção de leitura contínua. | `index.html`, `painel-leitura.js`, `principal.css` |
| 6 | Miniatura quebrada | Nenhum tratamento de `error` na `<img>`: o navegador desenhava o ícone nativo de imagem quebrada. | `biblioteca.js`, `painel-leitura.js`, `principal.css` |
| 7 | **Não relatado, encontrado na validação:** abaixo de 900 px não há como abrir a navegação | O CSS previa `.aplicativo[data-barra-mobile='aberta']`, mas **nada definia esse atributo** e não existia botão. A barra saía do fluxo com `translateX(-100%)` e não voltava. Quem abria numa janela estreita ficava sem navegação. | `index.html`, `biblioteca.js`, `principal.css` |

## 2. Limites e decisões

- **Fonte única para a altura da linha.** O ajuste escreve
  `--altura-linha-ampliado` no `.aplicativo`; o CSS e o virtualizador leem a
  mesma variável. Nenhuma altura é escrita por linha no DOM.
- **As variáveis de altura passaram de `:root` para `.aplicativo`.** Com
  `--altura-linha: var(--altura-linha-ampliado)` resolvido em `:root`, um
  override inline no `.aplicativo` mudava a variável e **não** mudava a linha.
- **O número de linhas do resumo acompanha a altura.** Era `-webkit-line-clamp:
  5` fixo; com linha menor, o texto passava a ditar a altura do `<td>` (129 px
  numa linha pedida de 88 px) e o virtualizador ficava fora de fase. Agora o JS
  calcula `--linhas-resumo` a partir da altura.
- **A transcrição não muda conteúdo.** As duas opções (`Mostrar tempos`,
  `Texto corrido`) só alternam apresentação sobre os mesmos segmentos já
  carregados. Nada é reescrito, resumido ou repontuado; nada volta ao banco.
- **Miniatura com falha vira espaço reservado**, mantendo proporção, duração e
  o botão de abrir. Não é um placeholder que esconde o problema: o
  carregamento é tratado no evento `error`.
- **Modo gaveta independe do estado salvo do desktop.** Recolher a barra no
  desktop não pode espremer a janela estreita.

## 3. Critérios de aceite — e o resultado

| Critério | Resultado |
|---|---|
| Recolher/expandir em 10 ciclos, ponteiro | 10/10 nos dois sentidos |
| Botão visível, dentro da barra e com o clique no centro | sim, nos dois estados |
| Recarregar com a barra recolhida e conseguir expandir | sim |
| Navegar entre as 3 telas nos 2 estados | 6/6 |
| Redimensionar 11 larguras (360–1558) × 2 estados | 22/22 sem transbordo e com busca, filtros, colunas e "Adicionar link" alcançáveis |
| Aumentar/diminuir/restaurar altura e alternar Ampliado/Compacto | 88–200 px, compacto fixo em 64 px |
| Biblioteca grande após ajuste de altura | 6 linhas no DOM; identidade, ordem e seleção preservadas |
| Ocultar/restaurar cada coluna | sim; seleção 46 px fixa; sem vazio residual |
| As 4 combinações de tempos/texto corrido | sim, com texto longo |
| Alternar apresentação não altera o persistido | texto idêntico ao original nas 4 combinações |
| Miniatura válida, ausente e com falha | 3/3 com o mesmo enquadramento |
| Pesquisa, filtros, ordenação, seleção, árvore, painel, Adicionar link | todos preservados |
| Foco visível e navegação por teclado | botão alcançado com 16 Tabs; Enter e Espaço funcionam |
| Sem exceções novas no console | 0 em todas as suítes |

## 4. Plano de validação executado

Em `platform/`:

```
npm test            183/183
npm run test:e2e     57/57
npm run verificar    TUDO OK
npm run typecheck    0 erros
npm run build        OK
```

Mais a suíte Playwright desta tarefa (scripts em
`testes/.tmp/`, executados com o Chrome do ambiente):

| Suíte | Cobertura | Resultado |
|---|---|---|
| `valida-barra` | 10 ciclos, recarregar, teclado, 3 telas | TUDO OK |
| `valida-transcricao` | 4 combinações, texto preservado, contexto | TUDO OK |
| `valida-altura` | passos, limites, compacto, seleção, rolagem | TUDO OK |
| `valida-miniatura` | válida, ausente, 404, painel | TUDO OK |
| `valida-gaveta` | abrir/fechar, véu, Esc, navegação em 3 larguras | TUDO OK |
| `valida-geral` | 22 combinações responsivas + fluxos existentes | 22/22 |

As miniaturas foram exercitadas com um PNG local e respostas 404/`abort`
controladas por `page.route`. **Isso é dublê, não prova contra o YouTube
real.**

## 5. O que não foi executado

- Importação real do YouTube nesta máquina (o ambiente continua bloqueando o
  domínio). O roteiro segue em `docs/roteiro-teste-f3.md`.
- Homologação visual humana: é do proprietário.
- `npm test` no Windows: não executado nesta sessão.

## 6. Próxima ação para outra sessão

1. Ler `docs/estado-atual.md` (§ da rodada de 21/11/2026).
2. Homologar com as capturas de `Continuidade de Projeto/arena-correcoes-2026-11-21/`.
3. Só depois avaliar a F6 — que **não** está autorizada.
