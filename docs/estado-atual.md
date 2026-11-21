# Estado de retomada — ContextFlow V1

> Atualizado ao fim de cada sessão. É o **primeiro** arquivo a ler, depois de
> `00-comece-aqui.md`. O que está abaixo da linha "Histórico" é registro, não
> estado vigente.

## Estado vigente — 21/11/2026 (revisado)

**F5-UI (reformulação da interface) implementada, testada e commitada.
Homologação humana pendente.** A próxima fatia autorizada é a **F6 (IA para
resumos)**, conforme `docs/04-plano-mestre.md` — mas o proprietário determinou
que a F6 **não** fosse iniciada nesta etapa.

| Fase | Situação | Commit | Evidência |
|---|---|---|---|
| F1 — fundação | homologada | `9fb9f32` | 38/38 na época |
| F2 — persistência | homologada | — | migrações 001–003 |
| F3 — ingestão real | corrigida no Windows, **aceite humano pendente** | `c6b7db5` | teste real com YouTube |
| F4 — fila persistente | implementada e testada | `5a13b3c` | SIGKILL, lease, fencing |
| F5 — Biblioteca | implementada e testada | `7b58f32` | virtualização, filtros, lote, coleções |
| **F5-UI** — reformulação | **implementada, aguardando homologação** | `9e7ce02`, `3db2e48`, `909843a`, `6d571c3`, `0b9a9bd`, `978401d` | — |
| **F5-QA** — revisão de qualidade | **implementada, aguardando homologação** | `F5-QA` (ver histórico) | **62/62 E2E** |
| F6 — IA para resumos | especificada, **não implementada** | `d9ef6a6` (spec) | — |

### Números desta máquina (Linux, Node v22)

```
npm test          183/183
npm run test:e2e   62/62
npm run verificar TUDO OK
npm run build     OK
npm run typecheck  0 erros
```

Os números do Windows do proprietário constam no histórico e são menores
(157 testes, 26 cenários) porque seis testes de shell são pulados lá.

### O que a F5-QA mudou

Revisão de qualidade da interface com duas skills (`docs/skills/README.md`
registra como cada uma foi usada e o que não pôde rodar).

**O defeito relatado — barra recolhe e não volta.** A coluna recolhida tem
56 px; a marca somava 87 px de conteúdo e o `.barra-lateral` tem
`overflow: hidden`. O botão de alternância ficava 17 px fora do clipe:
invisível e não clicável. `document.elementFromPoint` no centro dele devolvia
`.conteudo`. Correção: rótulos viraram elementos que o CSS alcança, a marca
empilha, e o botão (28×28) cabe nos 56 px. O teste de regressão pergunta ao
navegador quem está naquele pixel em três ciclos e **reprova se não for o
botão** — medir largura não pegava isso.

**Defeitos que a inspeção no navegador encontrou além do relatado:**

| Defeito | Efeito | Correção |
|---|---|---|
| Sem botão de menu abaixo de 900 px | navegação inalcançável no celular; o `grid` ainda reservava 256 px e deixava faixa vazia | gaveta com véu, foco, ESC e fechamento ao navegar |
| Miniatura quebrada | ícone de imagem partida na linha e no painel | fallback para preenchimento, como quando nunca houve miniatura |
| Linha real 127 px com CSS dizendo 104 | virtualização posicionava errado; rolagem pulava | altura derivada do clamp + botão; hoje 108 = 108 |
| `max-height` em `td` | ignorado pelo algoritmo de tabela; só escondia o sintoma | removido; o teto é o clamp |
| Texto "Biblio…" vazando da coluna recolhida | barra suja | rótulos envelopados e escondidos |
| Versão e placeholder em 2,44:1 | abaixo do mínimo legível | cor trocada (6,06:1) |
| "Trabalhos" colado a "Fila atualizada" | sem hierarquia | espaço + peso de subtítulo |
| Fila vazia sem direção | área em branco | estado vazio que ensina o próximo passo |
| Barra de lote em 2 linhas desalinhadas | planilha 40 px mais baixa | uma linha; rótulos e paddings enxutos |
| Miniatura 96 px em linha compacta de 64 | transbordo | 76 px no compacto |
| `font-size` duplicado no `.diagnostico` | lixo de manutenção | removido |

**Preservado por decisão de produto:** paleta, tabela de alta densidade,
colunas em caixa alta, painel lateral para o resumo (nunca linha expansível),
azul de destaque. Nada de redesign — só refinamento.

**Testes:** 183/183 e 62/62 (4 cenários novos de mobile + o ciclo da barra).
Todos os controles das três telas foram exercitados no navegador real via
Agent Browser: busca, ordenação, seleção, filtros, colunas, densidade, árvore,
painéis sobrepostos, janela Adicionar link (inclusive recusa de URL fora do
YouTube e devolução de foco) e navegação mobile.

### O que a F5-UI mudou

Reformulação centrada na Biblioteca, a partir dos dois mockups do proprietário
(guardados em `docs/mockups/`, com as capturas PNG). A spec está em
`docs/specs/f5-ui-reformulacao.md`.

- **Biblioteca** vira a área de trabalho: linhas de 136 px com miniatura de
  148×83 e **resumo legível na própria linha**, com limite de linhas e "ver
  mais". Alterna para 64 px no modo compacto.
- **Colunas configuráveis** (canal, duração, adicionado, estado, resumo,
  estado do resumo), persistidas em `localStorage`. Colunas são distintas de
  filtros e de ordenação — o painel diz isso explicitamente.
- **Painel sobreposto** de leitura, aberto só por botão explícito na miniatura
  (nunca ao selecionar linha). Traz título, miniatura, canal, duração, datas,
  coleções, link original, resumo completo e transcrição com timestamps
  clicáveis. Fechar devolve ao mesmo contexto.
- **Árvore lateral** (Canais, Playlists, Data de importação, Minhas coleções)
  com contadores e seleção que filtra pelas mesmas rotas. A barra recolhe de
  256 px para 56 px.
- **Janela "Adicionar link"** com validação local e envio para a importação
  que já existia — não há segundo mecanismo.
- **A tela "Leitura" deixou de existir** como aba: foi absorvida pela linha e
  pelo painel. `#leitura` redireciona para `#biblioteca`, para link antigo
  não quebrar.

### Adições ao backend (todas aditivas)

| Rota / campo | Por quê |
|---|---|
| `GET /api/biblioteca/:id/resumo` | a interface precisa **exibir** resumo; o contrato só expunha `temResumo`. Leitura pura: a F6 é quem escreve. |
| `GET /api/biblioteca/meses` | agrupar por mês no banco; derivar de uma página de 500 itens daria contagem errada. |
| `importadoDe` / `importadoAte` em `GET /api/biblioteca` | recorte real por data para a árvore. Quem não passa continua vendo tudo. |

### Defeitos encontrados e corrigidos nesta etapa

1. **Interface destruída no working tree.** A entrega anterior do Codex
   removeu 24 elementos que o JS consome e a própria tag
   `<script type="module" src="/js/aplicacao.js">`. Medido: 5/27 cenários E2E.
   As alterações foram descartadas e a árvore voltou a verde.
2. **Virtualizador calculando a janela errada.** A altura da linha estava
   copiada em JS (168 px) e no CSS (136 px). As duas fontes divergiram e a
   lista pulava ao rolar. A altura agora é **lida da variável CSS**
   `--altura-linha`.
3. **Janela limitada pelo total da consulta**, não pela quantidade já
   paginada: o render pedia índices inexistentes e a lista embaralhava.
4. **`hidden` sem efeito** em elementos com `display: grid/flex` declarado —
   o painel e a janela apareciam por cima da tela. Regra `[hidden]` global.
5. **Canal duplicado** na linha e resumo aparecendo em duas colunas ao mesmo
   tempo. Cada informação tem um lugar só.

### Pendências conhecidas

- **Homologação humana da F5-UI** e da F3 (teste real de YouTube no Windows).
- F6 (resumos por IA) especificada, não implementada. O botão "Gerar resumo"
  aparece **desabilitado com o motivo visível**.
- Drag-and-drop na árvore: deliberadamente fora (futuro).
- Os mockups em HTML usam Tailwind via CDN e **não abrem sem rede**; os PNG
  são a referência confiável e foram gerados compilando o Tailwind localmente.

## Comandos (a partir de `platform/`)

| Comando | Para quê |
|---|---|
| `npm install` | dependências de desenvolvimento |
| `npm run dev` | servidor de desenvolvimento |
| `npm run build` | typecheck + `dist` |
| `npm start` | execução do build |
| `npm test` | unidade + integração (182) |
| `npm run test:e2e` | navegador real via CDP (56) |
| `npm run verificar` | fumaça de endpoints e estáticos |
| `npm run typecheck` | só tipos |

`CONTEXTFLOW_PORTA`, `CONTEXTFLOW_HOST`, `CONTEXTFLOW_PASTA_DADOS` e
`CONTEXTFLOW_YTDLP` controlam o motor. Ver `docs/02-arquitetura.md`.

## Histórico

### 21/11/2026 — revisão de layout e uso com Playwright

Varredura com Playwright (Chrome do sandbox via `executablePath`, já que o
download do Chromium é bloqueado) em todas as telas e controles, medindo o que
a tela faz. Correções no commit `c5fa1a9`:

| Defeito medido | Correção |
|---|---|
| colunas desencontradas até 33 px (`vertical-align: middle` + padding só em título/resumo) | respiro vertical igual em todas as células; desvio caiu a 5 px |
| tabela cortava 53 px da última coluna | `min-width: 1180px` na `<table>` removido; larguras redistribuídas |
| selo "Pronto" duas vezes na mesma linha | coluna de estado do vídeo removida (7 colunas); selo junto do título só quando exige atenção |
| id cru do YouTube na sub-linha | sub-linha mostra coleções e data |
| `#limpar-filtros` inalcançável com busca ativa (ficava dentro do painel fechado) | foi para a barra; aparece só com recorte aplicado |
| 11 controles em duas faixas, 5 desabilitados | ações de lote só existem com seleção; barra em uma linha (68 → 33 px) |
| árvore não desmarcava e somava recortes entre grupos | segundo clique desfaz o nó; uma seleção por vez |
| árvore ocupava 256 px em telas onde não filtra | some fora da Biblioteca (`data-tela`) |
| painel de leitura mostrava UUID da coleção e "pronto" minúsculo | mostra o título; estado capitalizado |
| compacto truncava o título e ceifava a miniatura | duas linhas de título; miniatura de 72 px em 64 |

Também entrou o atalho `/` para a busca (o mockup anuncia e o código não
tinha). Verificação ao final: 183/183 unitários, 62/62 E2E, nenhum erro de
console e sem transbordo horizontal em 1440/1280/980/420 px.

**Correção crítica (`d22750a`).** O app abria com o conteúdo numa tira de
~56 px e o resto da tela vazio, sem nada clicável. `.aplicativo[data-barra=
'recolhida']` (que vale em qualquer largura) vencia, por especificidade, a
regra da media query de 900 px que troca o grid para uma coluna. Quem tinha
recolhido a barra no desktop — estado salvo em `localStorage` — abria a tela
pequena com duas colunas: gaveta fora do fluxo e conteúdo espremido. A
media query agora inclui o seletor de atributo. Reproduzido em 900, 880, 700,
420 e 360 px; o teste E2E novo falha no CSS antigo (`conteúdo=56px de
390px`) e passa no atual — **63/63**. Em telas com rolagem horizontal na
planilha, a barra de rolagem fica visível e uma sombra indica o conteúdo à
direita.

**Segunda correção (`de13751`) — o cache era metade do problema.** O defeito
voltou numa captura seguinte mesmo com a correção publicada: o navegador
ainda tinha a folha antiga. Reproduzido de propósito (CSS anterior + barra
recolhida salva) e resolvido nas duas pontas: a coluna da barra agora vem de
`--coluna-barra` (cada estado muda a variável; a media query de 900 px troca
o grid para uma coluna), o que elimina a disputa de especificidade, e
HTML/CSS/JS passam a ser servidos com `cache-control: no-store`, com
`?v=2` no link da folha. Imagens e fontes seguem com cache de um dia.
Verificado em 14 larguras (320–1600) × 2 estados: 28/28.

### Sessões anteriores a 21/11/2026

Base documental: ZIP `ContextFlow_Pacote_Execucao_V1 (1).zip` (18/11/2026).
O projeto original em `../contextflow/` permanece **intacto e somente
leitura** — nenhuma escrita foi feita nele.

| Fase | Commit | O que entregou |
|---|---|---|
| F1 | `9fb9f32` | monólito modular, contratos, servidor HTTP, UI mínima |
| F2 | — | SQLite com `node:sqlite`, migrações 001–003 |
| F3 | `c6b7db5` | yt-dlp, transcrições com tempo, leitor |
| F4 | `5a13b3c` | fila persistente, lease, fencing, retry, playlist |
| F5 | `7b58f32` | Biblioteca com virtualização, filtros, lote, coleções |
| F6 | `d9ef6a6` | apenas a especificação |

Ambiente do proprietário: Windows/PowerShell, Node v22.12.0, yt-dlp 2026.03.17,
Chrome real via CDP. Nenhum login, cookie, chave ou token foi usado nas
validações.

**Decisões que continuam valendo:** monólito modular; `node:sqlite` (o
`better-sqlite3` não instala em árvore limpa); sem etapa de build no frontend
(JS puro em módulos ES servido pelo motor); sem Whisper na V1; chat/RAG só na
V2.
