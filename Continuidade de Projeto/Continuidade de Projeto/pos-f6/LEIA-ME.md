# Ajustes pós-F6 — registro da rodada

**Data:** 22/11/2026 · **Branch:** `arena/735d302d-contextflow` (workspace
`projeto/contextflow2`) · **Commit:** `5dbb7e0` · **Base:** `71b64b4`
**F7:** não iniciada, por instrução do comando.

## O que este commit entrega

Os oito ajustes do `comando_codex_ajustes_pos_F6_ContextFlow.md`, com SPEC
prévia em `docs/specs/f6a-ajustes-pos-f6.md`.

| Item | O que mudou | Arquivos principais |
|---|---|---|
| 1 | Etapas visíveis no envio + faixa de atividade com progresso real | `js/adicionar-link.js`, `js/aplicacao.js`, `css` |
| 2 | Limpeza do histórico por categoria, confirmação e recusa de ativo | `aplicacao.ts`, `repositorio-trabalhos.ts`, `index.html`, `js/aplicacao.js` |
| 3 | Preferências de leitura num registro único e mesclado | `js/preferencias-leitura.js`, `js/painel-leitura.js` |
| 4 | Cópia local da capa, servida pela origem, com limite de tentativas | migração 6, `miniaturas/*`, `aplicacao.ts` |
| 5 | Markdown seguro na linha e no painel | `js/markdown.js`, `css` |
| 6 | Fonte do resumo 11–20 px, persistida | `index.html`, `js/biblioteca.js`, `css` |
| 7 | Hierarquia da barra sem remover controles | `index.html`, `css`, `js/biblioteca.js` |
| 8 | Miniatura lateral ↔ empilhada por medida real | `js/biblioteca.js`, `css` |

## Números medidos (todos com saída 0)

```
npm test                        232/232   (198 anteriores + 34 novos)
Playwright pós-F6                13/13
CDP test:e2e                     57/57
refinamentos                      9/9
resumos F6                        7/7
npm run build                    OK (typecheck incluso)
npm run verificar                nove OK / TUDO OK
teste de integração do commit     9/9
```

## Capturas

`suite/` — saídas automáticas da suíte Playwright pós-F6 (dados descartáveis):

| Arquivo | Prova |
|---|---|
| `01-markdown-painel.png` | títulos, listas, ênfase, código, citação e link renderizados |
| `02-markdown-hostil.png` | `<script>`, `onerror`, `<b>`, `<iframe>` e `javascript:` como TEXTO |
| `03-preferencias-transcricao.png` | tempos/corrido aplicados e persistidos |
| `04-fonte-resumo.png` | fonte maior sem estourar a linha |
| `05-layout-empilhado.png` | miniatura em cima, título abaixo, coluna estreita |
| `06-layout-lateral.png` | volta ao lado a lado ao reduzir a altura |
| `07-barra-controles.png` | grupos visíveis sem remoção de botão |
| `08-limpeza-historico.png` | categorias com contagem e cópia do que NÃO é apagado |
| `09-historico-limpo.png` | depois da limpeza, biblioteca intacta |
| `10-enviando.png` | botão com spinner e "Enviando…" |
| `11-faixa-atividade.png` | atividade na Biblioteca com progresso real ou indeterminado |

`*.png` na raiz desta pasta — capturas do **app real** (porta 4781, banco
local, 6 vídeos):

| Arquivo | Prova |
|---|---|
| `01-biblioteca-app-real.png` | biblioteca com o código novo |
| `02-painel-colunas-fonte.png` | controle "Fonte do resumo" ao lado da altura |
| `03-limpeza-historico-app-real.png` | painel abrindo com categorias reais |
| `04-barra-com-selecao.png` | grupo de lote aparecendo com 1 selecionado |
| `05-adicionar-link.png` | janela de envio |
| `06-layout-baixa-64.png` | linha baixa: título à direita, miniatura 64×36 |
| `06-layout-media-180.png` | miniatura cresceu para 193×109, ainda lateral |
| `06-layout-alta-560.png` | linha alta: empilhado, miniatura 392×220 |
| `07-layout-empilhado-estreito.png` | coluna de 305px: empilhado, título abaixo |

Medições registradas nessa rodada (largura da célula × miniatura):

```
altura  64 → lateral    64×36     razão 1,78   célula 392
altura 180 → lateral   193×109    razão 1,78   célula 392
altura 560 → empilhado 392×220    razão 1,78   célula 392
coluna 305 → empilhado 305×172    razão 1,78   célula 305
```

Proporção 16:9 preservada em todos; nenhuma miniatura ultrapassou a coluna.

## Decisões que não podem ser desfeitas sem fato novo

1. **Limpar histórico ≠ apagar vídeo.** Só a entrada de fila sai. Vídeo,
   transcrição, resumo e coleção têm comandos próprios.
2. **"Excluído" não existe** no domínio. Não inventar o estado para agradar
   uma tela.
3. **Miniatura é cache, não mídia.** O motor segue com `--skip-download`.
4. **Markdown nunca usa `innerHTML`.** O resumo vem de IA: é não confiável.
5. **Layout da miniatura é medido**, não escolhido por breakpoint.
6. **Nenhuma dependência de produção nova.**

## Correção do item 8 após o teste do proprietário (22/11, mesmo dia)

O print enviado mostrou que o item 8 **não estava resolvido**: linha alta +
coluna larga → miniatura parada em tamanho fixo, vazio embaixo, título ao lado.

**Duas travas somadas:** `clamp(..., 420px)` no CSS e `max-width: 55%`. Numa
coluna de 690 px, a imagem parava em 380 px; e como `380 + 13 + 170` cabia, o
modo empilhado nunca era alcançado.

**Correção:** o CSS passou a consumir `--miniatura-largura` escrita pelo JS, sem
teto próprio; o JS compara o espaço vertical real (`(altura−24) × 16/9`) com o
espaço lateral disponível e só mantém o lado a lado quando a imagem cabe
inteira ali.

Medido no app real (largura × altura da miniatura):

```
coluna 758:  71×40   199×112  348×196  491×276  629×354   758×426
coluna 678:  71×40   199×112  348×196  491×276  629×354   678×381
coluna 358:  71×40   124×70   274×154  358×201  358×201   358×201
altura:      64      136      220      300      420       600
```

Lateral nas quatro primeiras colunas de altura; empilhado a partir de 420/300
conforme a largura. Razão 16:9 em todas; nunca ultrapassa a coluna.

**Prova de regressão:** reintroduzindo a lógica antiga, o cenário novo falha nos
quatro sintomas (`lateral`, 374 px, 210 px de altura, título ao lado); com a
correção passa. Suíte Playwright: **13 cenários**.

**Limite declarado:** com a coluna de resumo visível e texto longo, a linha é
ditada pelo resumo e sobram ~48 px abaixo da imagem — é o `max-height` do bloco
de texto, não um teto da imagem.

## O que a execução corrigiu em relação ao plano inicial

- `@container` não estiliza o próprio container → cálculo em JS.
- O critério extra "altura ≥ 300 empilha" empilhava cedo demais → removido.
- Texto mínimo de 190px disparava no limite exato → 170px, medido.
- `max-height` em `table-cell` não funciona → limite no bloco interno.
- Dois módulos gravando o mesmo objeto do `localStorage` se apagavam →
  módulo de preferências com mescla.
- `Number(null) === 0` fazia `fonteResumo: null` virar 11px → exige `number`.

## Pendências de homologação (não declarar como feito)

- Repetir a matriz de comandos no **Windows** do proprietário.
- Conferir, com CDN real do YouTube, a cópia local da capa depois de uma
  falha 403/expiração.
- Validar a limpeza do histórico no **banco pessoal** (o teste usa dados
  descartáveis e um trabalho sintético).
- O defeito de abertura do sistema, relatado em rodada anterior, **continua
  sem homologação**.
- Divergência de repositório: este commit está em `projeto/contextflow2`
  (repo de trabalho, sem remoto). O clone `~/contextflow` — origem do PR #1 —
  está na versão F5-UI e **não contém** a F6 nem esta rodada. Unificar isso é
  decisão do proprietário; nada foi enviado ao GitHub por conta própria.
