# Estado de retomada — ContextFlow V1

> Atualizado ao fim de cada sessão. É o **primeiro** arquivo a ler, depois de
> `00-comece-aqui.md`. O que está abaixo da linha "Histórico" é registro, não
> estado vigente.

## Estado vigente — 21/11/2026 (revisado)

**F5-UI (reformulação da interface) implementada, testada e commitada.
Homologação humana pendente.** A F6 (IA para resumos) está somente especificada
e é a próxima na sequência do plano, mas o proprietário determinou que
**não** fosse iniciada nesta etapa.

### Direção vigente — atualização documental de 21/11/2026

**Novo pedido preparado para a Arena:** o proprietário solicitou um arquivo
de texto para encaminhar, com correções da barra lateral que não reabre,
responsividade/largura, altura ajustável no modo Ampliado, colunas, miniaturas
e duas opções independentes de transcrição (tempos e texto corrido). O arquivo
está na raiz da pasta entregue: `../PEDIDO-PARA-ARENA-CORRECOES-INTERFACE.txt`.
As três imagens fornecidas foram copiadas para
`../Continuidade de Projeto/pedido-correcao-ui-2026-11-21/`.
Playwright em navegador real foi solicitado explicitamente para validar essa
tarefa, complementando a suíte CDP existente. A Arena deve escrever a SPEC
antes de implementar, trabalhar dentro da pasta entregue e seguir suas skills.
**Status:** pedido redigido para envio pelo proprietário; não enviado pelo
Codex, não implementado e não validado. F6 continua fora do escopo.

- **Pedido atual:** manter documentação e continuidade conforme o estado real.
  Codex atua como parceiro de raciocínio; comandos de implementação serão
  preparados com o proprietário para a Arena. Não refazer a revisão visual
  enviada apenas como contexto e não iniciar F6.
- **Relato do proprietário:** a Arena já concluiu a revisão visual/funcional
  descrita no texto anexado, incluindo o pedido de corrigir a barra lateral.
  Isso registra o relato, sem transformar o texto do pedido em evidência de aceite.
- **Fato local:** branch `main`, base desta atualização `2c98678`; não há nova
  alteração local em `platform/` nem commit adicional da Arena identificado
  nesta retomada. A regressão disponível é a da base `0fdf6e8`, abaixo.
  A conclusão da Arena não foi homologada nem revalidada aqui.
- **Correções documentais:** README atualizado de F1 para F5-UI; navegação de
  três telas e decisão SQLite/sem ORM reconciliadas com decisões já registradas;
  arquitetura física, matriz de aceite e limite da F6 alinhados. Nenhuma nova
  funcionalidade ou mudança de escopo foi decidida.
- **Limites da prova:** os 57 E2E não comprovam o acesso real ao botão da barra
  após recolher, pois o teste usa `.click()` programático. A tentativa posterior
  com Agent Browser foi interrompida após o esclarecimento do proprietário e
  seus comandos de reprodução falharam; não comprova defeito nem correção.
  Detalhes em `../Continuidade de Projeto/qualidade-ui-2026-11-21/LEIA-ME.md`.
- **Validação desta alteração documental:** conferência de referências locais,
  confronto com código e logs existentes, `git diff --check`. Suítes não
  reexecutadas: nenhum código, teste, dependência ou contrato foi alterado.
- **Alterações preexistentes preservadas:** ZIP removido da raiz do Git;
  `LEIA-ME.md`, `ESTADO-DA-ENTREGA-19-11-2026.md` e `iniciar.bat` avulsos,
  não versionados. A orientação vigente está nos documentos versionados.
- **Próxima ação:** incorporar a revisão e o relatório da Arena quando
  disponíveis, identificando commit, cenários e evidências; então preparar
  juntos o próximo comando de implementação. Homologação humana pendente.

| Fase | Situação | Commit | Evidência |
|---|---|---|---|
| F1 — fundação | homologada | `9fb9f32` | 38/38 na época |
| F2 — persistência | homologada | — | migrações 001–003 |
| F3 — ingestão real | corrigida no Windows, **aceite humano pendente** | `c6b7db5` | teste real com YouTube |
| F4 — fila persistente | implementada e testada | `5a13b3c` | SIGKILL, lease, fencing |
| F5 — Biblioteca | implementada e testada | `7b58f32` | virtualização, filtros, lote, coleções |
| **F5-UI** — reformulação | **implementada, aguardando homologação** | `9e7ce02`, `3db2e48`, `909843a`, `6d571c3`, `0b9a9bd`, `978401d` | **57/57 E2E** |
| F6 — IA para resumos | especificada, **não implementada** | `d9ef6a6` (spec) | — |

### Revisão local — Windows, base `0fdf6e8`

Repositório conferido em `Desktop/projeto/contextflow2`, branch `main`.
Revisão documental e regressão executadas após a reformulação; nenhum código
do produto ou layout foi alterado nesta revisão. F6 permanece sem implementação.

| Comando executado | Resultado real (Node v22.12.0, Windows) |
|---|---|
| `npm install` | saída 0; dependências atualizadas, 10 pacotes auditados, zero vulnerabilidades |
| `npm test` | saída 0; 183 testes: 177 aprovados, 6 ignorados, zero falhas |
| `npm run test:e2e` | saída 0; 57/57 cenários aprovados em navegador real |
| `npm run verificar` | saída 0; nove verificações OK, `TUDO OK` |
| `npm run build` | saída 0; inclui `npm run typecheck`, sem erros |

Os seis testes ignorados usam scripts de shell/shebang incompatíveis com Windows;
não são seis aprovações. Volume exercitado no E2E: 5.004 vídeos, 23 linhas no DOM;
120 quadros com mediana 16,7 ms, p95 16,8 ms e máximo de 27 linhas.
Dados descartáveis em `platform/testes/.tmp`, sem uso do banco pessoal.

Evidências externas: `../Continuidade de Projeto/revisao-f5-ui-0fdf6e8/`
contém os cinco logs completos e capturas geradas pela suíte. São provas da
revisão indicada, não de futuras alterações. Importações contra YouTube real
**não executadas nesta revisão**: a regressão usa processos/fixtures controlados;
a prova anterior da F3 não foi repetida. Homologações humanas continuam pendentes.

**Divergências encontradas na retomada:**
- `LEIA-ME.md` avulso, não versionado, aponta para `~/contextflow/`, caminho
  inexistente nesta máquina. Não seguir esse redirecionamento nem alterar o
  original Python em `Desktop/contextflow`. O arquivo foi preservado.
- A pasta de continuidade só continha evidências anteriores à F5-UI; a revisão
  acima e o índice externo agora identificam a base atual.
- Na revisão anterior, o escopo canônico enumerava quatro telas e banco/ORM a definir; a SPEC
  F5-UI e a implementação usam três telas, leitura integrada e SQLite já decidido.
  Divergência reconciliada na atualização documental atual com as decisões
  já registradas, sem retirar capacidades de leitura previstas para V1.
- A descrição antiga das capturas em `docs/mockups/evidencia/` afirma 5.000
  vídeos e 1.667 resumos, mas `biblioteca-com-resumos.png` exibe seis resultados.
  Essa captura não comprova o volume anunciado. O volume foi comprovado
  separadamente no E2E desta revisão; as métricas históricas de 1.667 resumos
  não foram reproduzidas.

As próximas ações vigentes estão no início deste documento. F6 não deve ser
iniciada; a sequência do plano mestre não constitui nova autorização.

### Registro anterior — Linux, Node v22

```
npm test          183/183
npm run test:e2e   57/57
npm run verificar TUDO OK
npm run build     OK
npm run typecheck  0 erros
npm run build      OK
```

Os antigos 157 testes e 26 cenários do Windows correspondem à F4, não à
suíte atual. A contagem Windows desta revisão está registrada acima.

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
| `npm test` | unidade + integração (183; 6 ignorados no Windows) |
| `npm run test:e2e` | navegador real via CDP (57) |
| `npm run verificar` | fumaça de endpoints e estáticos |
| `npm run typecheck` | só tipos |

`CONTEXTFLOW_PORTA`, `CONTEXTFLOW_HOST`, `CONTEXTFLOW_DADOS` e
`CONTEXTFLOW_YTDLP` controlam o motor. Ver `docs/03-arquitetura-e-contratos.md`
e `platform/src/motor/src/nucleo/configuracao.ts`.

## Rodada de 21/11/2026 — correções pontuais pedidas pelo proprietário

**Implementadas e validadas tecnicamente. Homologação humana pendente.**
SPEC: `docs/specs/f5-ui-correcoes-2026-11-21.md`. Pedido de origem:
`Continuidade de Projeto/PEDIDO-PARA-ARENA-CORRECOES-INTERFACE.txt`.

| # | Defeito | Causa raiz | Correção |
|---|---|---|---|
| 1 | Barra recolhe e não reabre | botão dentro de `.marca` era empurrado para x=49 numa barra de 56 px, fora da área visível; rótulo era texto solto, impossível de ocultar | botão no pé da barra, visível nos dois estados, com `aria-expanded`; rótulo em `<span>` |
| 2 | Faixa morta à direita | `.tela` com `max-width` sem centralização | `margin-inline: auto` |
| 3 | Sem ajuste de altura | não existia | controle no painel de colunas, 88–200 px, fonte única na variável CSS |
| 4 | "Resumo" aparecia desmarcado; vazio de 218 px | `resumo-estado` ausente da lista de colunas ocultas; `table-layout: fixed` distribuía a sobra no checkbox | seletor incluído; `.col-selecao` com largura fixa; piso da tabela acompanha as colunas visíveis |
| 5 | Transcrição em faixa estreita | coluna de tempo fixa, sem leitura contínua | duas opções independentes; nada do conteúdo muda |
| 6 | Miniatura quebrada | sem tratamento de `error` | fallback com proporção preservada na lista e no painel |
| 7 | **Achado na validação:** sem navegação abaixo de 900 px | CSS previa `data-barra-mobile`, nada o definia; não havia botão | botão de menu, véu, Esc e fechamento ao escolher a tela |

**Números desta máquina (Linux, Node v22.22.3):**

```
npm test            183/183
npm run test:e2e     57/57
npm run verificar    TUDO OK
npm run typecheck    0 erros
npm run build        OK
```

Mais 6 suítes Playwright desta tarefa (barra, transcrição, altura, miniatura,
gaveta, responsividade geral) — todas OK. O detalhamento está na SPEC §3–§4.

**Ressalvas registradas:** as miniaturas foram exercitadas com respostas
controladas por `page.route` (dublê), não contra o YouTube real; a importação
real segue não executada nesta máquina; a homologação visual é do proprietário.

Playwright entrou como **dependência de desenvolvimento** (`1.56.1`), a pedido
explícito do proprietário. Não há dependência nova de produção.

## Histórico

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
