# SPEC F6-B — Refinamento funcional, organização e identidade visual

> **Status:** especificada; execução em quatro partes (A–D), conforme pedido.
> **Base:** `c3e8286` (main limpa). **F7 não autorizada.**
> **Homologação humana pendente até avaliação do proprietário.**

Este documento é a investigação prévia exigida pelo protocolo. Nada aqui é
presunção: cada item traz o que foi **lido no código** e o que foi **medido**.

---

## 0. Ponto de partida verificado

| Verificação | Resultado |
|---|---|
| `git status` | limpo em `c3e8286` (dois `\r` acidentais no índice foram descartados) |
| `npm test` | **238/238** (232 aprovados, 6 ignorados) |
| Suítes Playwright existentes | `pos-f6` 13, `miniatura` , `capas` , `visualizacao` 4/4, `refinamentos` 9, `resumos` 8 |
| Commits do proprietário preservados | `adb6c57`, `bd41a13`, `51ba4a9`, `c3e8286` |
| Contratos de trabalho | `TipoTrabalho` = 4 valores; `EstadoTrabalho` = 5; **sem estado "excluído"** |
| Rotas de coleções | listar, criar, adicionar vídeos, remover vídeo. **Faltam renomear, excluir e esvaziar.** |
| Rotas de trabalhos | criar, listar, detalhe, itens, cancelar, repetir, histórico (resumo/limpar). **Falta remover trabalho individual.** |

### O que NÃO será tocado (mudanças do proprietário)

- `f6a-miniatura-adaptativa.md` — `data-layout`, cálculo por medidas reais.
- `f6a-recuperacao-miniaturas.md` — candidatos maxres/hq, botão "Tentar carregar
  miniatura", `forcar`, ETag/no-cache.
- `f6a-prompt-persistente-painel.md` — prompt sem `{transcricao}` recebe a
  transcrição uma vez; formulário protegido contra resposta atrasada.
- `f6a-painel-visualizacao.md` — painel horizontal recolhível, um só botão
  Visualização, IDs `abrir-colunas`/`painel-colunas` preservados.

---

## 1. Identidade visual

**Decisão:** trocar somente os **valores dos tokens** em `:root` e ajustar
componentes que dependem de cor fixa. Nenhum componente será reescrito por
causa de cor; nenhuma regra de layout muda nesta parte.

Tokens atuais relevantes (`principal.css`): `--grafite-950…500`, `--texto-forte`,
`--texto`, `--texto-fraco`, `--azul`, `--azul-forte`, `--borda`, `--sucesso`,
`--alerta`, `--erro`.

Mapeamento proposto (mantendo os **nomes** dos tokens para não quebrar nada):

| Token | Antes | Depois | Uso |
|---|---|---|---|
| `--grafite-950` | `#080b12` | `#0B0B0D` | fundo principal |
| `--grafite-900` | `#0d111a` | `#101012` | barra lateral |
| `--grafite-850` | `#111723` | `#151517` | superfícies/painéis |
| `--grafite-800` | `#161f30` | `#1C1C1F` | campos e controles |
| `--grafite-700` | `#1f293d` | `#242427` | controle desabilitado/trilho |
| `--grafite-600` | `#2b3750` | `#303034` | bordas fortes |
| `--grafite-500` | `#46536b` | `#71717A` | texto discreto |
| `--borda` | `#212c3d` | `#303034` | divisórias |
| `--borda-forte` | `#2d3a4f` | `#3F3F46` | divisória em destaque |
| `--texto-forte` | `#e8ecf3` | `#F4F4F5` | títulos |
| `--texto` | `#b9c2d0` | `#E4E4E7` | corpo |
| `--texto-fraco` | `#8593a8` | `#A1A1AA` | secundário |
| `--azul` | `#4c9aff` | `#3B82F6` | informação |
| `--azul-forte` | `#0070f3` | `#E4E4E7` | **ação primária** (clara, como na referência) |
| — | — | `#18181B` | texto sobre ação primária |
| `--sucesso` | `#3fb950` | `#22C55E` | concluído |
| `--alerta` | `#d29922` | `#F59E0B` | processando/atenção |
| `--erro` | `#f85149` | `#EF4444` | falha |

Consequências obrigatórias:

- `--azul-forte` deixa de ser azul e passa a ser claro → **todo** lugar que usa
  essa variável como fundo precisa de texto escuro. Hoje `.botao-primario` já
  põe `#fff`: passa a `--texto-sobre-primario`. Revisar `.botao-adicionar`,
  foco de botões e `#confirmar-adicionar[data-estado]`.
- Contraste: `#A1A1AA` sobre `#0B0B0D` = 8,1:1; `#E4E4E7` sobre `#0B0B0D` =
  15,9:1; `#18181B` sobre `#E4E4E7` = 13,7:1. Todos acima de AA.
- Sem gradientes decorativos, sem glassmorphism, sem brilho novo. Remover
  `box-shadow` colorido do botão primário.
- Markdown e resumo longo mantêm `--fonte-resumo` e as regras já validadas.

**Aceite:** nenhum `#hex` novo em componente (só em `:root`); contraste
verificado por script; captura lado a lado com a referência.

---

## 2. Importação com feedback imediato na Biblioteca

**Problema medido em código:** `adicionar-link.js` mostra "Enviando…"/"Na fila",
fecha a janela em 900 ms e o usuário fica na Biblioteca — mas **nada aparece na
lista** até o trabalho terminar e a Biblioteca recarregar. Não há linha
provisória.

**Decisão (sem segunda fila):**

- Fonte única: `GET /api/trabalhos?raizes=1` já existente. Nenhum estado novo
  no frontend além de um `Map` em memória ligado a id de trabalho.
- Ao aceitar o trabalho, a Biblioteca insere uma **linha provisória** no topo
  com: miniatura em esqueleto, título `Importando…` (ou o título real quando o
  trabalho já trouxer `resultado.video.titulo`), selo de estado e barra.
  A linha é marcação `data-provisorio="<idTrabalho>"`, não um `Video`.
- **Reconciliação:** quando o trabalho chega a `concluido` e traz `videoId`, a
  Biblioteca recarrega e remove a provisória. A deduplicação é a que já existe
  (por `youtube_id`), então não há vídeo dobrado.
- **Falha:** a provisória sai da Biblioteca e um aviso `role="status"` diz o
  motivo; o registro continua em Importações (que já lista o trabalho).
- **Persistência:** ao recarregar a página, a provisória é reconstruída a partir
  dos trabalhos ativos (`raizes=1`), não do `localStorage`. Assim continua
  coerente após navegação/reinício sem criar fonte de verdade paralela.
- A janela fecha imediatamente após o 202 (sem o `setTimeout` de 900 ms).

**Aceite:** Playwright com POST controlado → linha provisória visível com
indicador, depois reconciliada sem duplicar; caso de falha remove a linha e
mostra o aviso; reload no meio do processo reconstrói a provisória.

---

## 3. Tela de Importações em tabela

**Problema:** `#lista-trabalhos` renderiza `article.trabalho` — cartões grandes.

**Decisão:** `table` compacta, colunas:

| Coluna | Conteúdo |
|---|---|
| seleção | checkbox por linha + "selecionar visíveis" |
| Trabalho | título (`titulo` do detalhe) + tipo legível |
| Tipo | `importar-video`, `importar-playlist`, `importar-lote`, `gerar-resumo` |
| Criado | data curta/hora |
| Progresso | barra + `%` **só** quando `progresso != null` ou contadores fechados |
| Estado | badge com **texto** (não só cor) |
| Ações | cancelar/repetir/remover conforme estado |

- Filtros: busca textual, tipo, estado. Reaproveitam os parâmetros existentes
  (`estado`) e filtram o tipo no cliente sobre a página carregada — a API já
  pagina por cursor; não inventar paginação nova.
- Seleção múltipla com ações em lote compatíveis: **cancelar** (só ativos),
  **repetir** (só terminais com falha/cancelado), **remover do histórico** (só
  terminais). Seleção com mistura incompatível: ação desabilita e explica.
- "Limpar histórico por categoria" continua existindo (já implementado em
  F6-A) e passa a conviver com a remoção individual.
- **Extensão mínima necessária:** `DELETE /api/trabalhos/:id` — remove **um**
  trabalho terminal do histórico. Recusa 409/422 se ativo. Não apaga vídeo.
- Estados não dependem só de cor: badge tem texto; barra tem `aria-valuenow`
  quando determinada e texto "processando" quando não.
- Formulário de importação permanece, no topo, com a nova pele.

**Aceite:** tabela com as colunas; filtros; seleção múltipla com as três ações;
confirmação para remover; API recusa ativo; após remover, biblioteca intacta.

---

## 4. Resumo sem sair da tela

**Problema relatado:** pedir resumo pelo cartão fecha o cartão e navega para
Importações.

**Decisão:** o painel permanece aberto; passa a mostrar três estados:

- `na-fila` → "Aguardando na fila" + botão Cancelar;
- `executando` → "Gerando resumo…" com barra indeterminada;
- `falhou` → mensagem do erro + **Tentar novamente**.

A Biblioteca marca o vídeo com selo "Gerando" (já existe `estadoResumo ===
'processando'`; passa a reagir por polling dos trabalhos ativos). Ao concluir,
o painel refaz `GET /api/biblioteca/:id/resumo` e a linha é invalidada. Nenhum
`mostrarTela('importacoes')` no fluxo. Botão "Ver em Importações" permanece como
opção, nunca automático.

**Aceite:** Playwright com provedor HTTP controlado: o painel **não** fecha, o
estado aparece, o conteúdo atualiza sozinho ao concluir, a falha permite repetir.

---

## 5. Miniaturas

**Estado atual (do proprietário, `bd41a13`):** já tenta `maxresdefault` e
`hqdefault`, tem botão manual e revalida por ETag. 231 testes, 3/3 capas.

**O que falta, pelo código:**

- Reparo em lote das capas antigas que ficaram `falha`/sem arquivo — hoje só
  há recuperação por vídeo. Proposta: `POST /api/miniaturas/reparar` que varre
  vídeos sem arquivo local, respeitando o limite de tentativas, em lotes
  pequenos, sem bloquear a resposta (fila leve em memória do próprio serviço).
- O botão "Tentar carregar miniatura" deve aparecer **também** na linha da
  Biblioteca (hoje o fallback é passivo).
- Placeholder acessível com texto e ação.

**Aceite:** teste com CDN local (404 → 200, maxres 404 → hq 200), reparo em
lote recupera N capas, nenhuma requisição repetida em laço, falha declarada.

---

## 6. Árvore lateral com vídeos

**Estado:** `arvore-organizacao.js` (178 linhas) monta grupos e emite filtro.
Não lista vídeos.

**Decisão:** nova seção **Todos os vídeos** com carregamento progressivo:

- Cabeçalho com campo de busca local (filtra a lista carregada, com aviso de
  que a busca completa está na Biblioteca).
- Carrega 50 por vez via `GET /api/biblioteca?limite=50` + cursor; botão
  "Carregar mais" dentro da seção. Nunca renderiza a biblioteca inteira.
- Cada item: título (truncado), canal, e clique → seleciona o vídeo na
  Biblioteca, rolando até ele e destacando-o (sem recarregar tudo).
- Grupos existentes (canal/playlist/data/coleção) continuam filtrando.
- Estado aberto/fechado por grupo persiste na chave já usada
  (`contextflow.arvore.aberto`).
- Nada de registro persistente novo só para navegação.

**Aceite:** expandir/recolher, busca, clique destaca a linha certa, 50 por vez,
recolhível continua funcionando com o botão acessível.

---

## 7. Filtros ativos visíveis

**Estado:** `#aviso-selecao` existe; filtros aplicados não aparecem na barra.

**Decisão:** faixa `#filtros-ativos` logo abaixo da barra de ferramentas, com um
`chip` por filtro aplicado: `Canal: X ×`, `Playlist: Y ×`, `Coleção: Z ×`,
`Período: 01/11–30/11 ×`, `Busca: "termo" ×`. Cada `×` remove **aquele** filtro
(só estado de tela + nova consulta). Botão "Limpar todos" ao lado.

Não remove vídeos, não altera coleções, não escreve no banco: filtro é consulta.

**Aceite:** aplicar canal pela árvore → chip aparece; `×` remove e a lista
recarrega; "Limpar todos" volta ao estado sem filtro; contagem de resultados
confere com a API.

---

## 8. Coleções completas

**Faltam no backend:** renomear, excluir, esvaziar.

Extensão mínima (rotas e métodos, sem migração — a tabela já existe):

| Operação | Rota | Garantia |
|---|---|---|
| Renomear | `PATCH /api/colecoes/:id` `{titulo}` | valida 1–200; não toca em vídeos |
| Excluir | `DELETE /api/colecoes/:id` | apaga `colecoes` + `colecao_videos`; **vídeos intactos** |
| Esvaziar | `DELETE /api/colecoes/:id/videos` | apaga só vínculos; devolve quantos |

Frontend: menu de contexto na árvore (renomear/excluir/esvaziar) e na Biblioteca
(ações de coleção já existentes passam a usar o diálogo próprio, não `prompt`).

**Correção de contrato (bug confirmado):** `adicionar-link.js` envia
`{videoId}` para `/api/colecoes/:id/videos`, mas a rota exige
`{videoIds: [...]}` → hoje o vínculo **sempre falha em silêncio** (o `catch`
engole). Corrigir para `{videoIds: [id]}` e reportar falha em vez de engolir.
Além disso, ao importar, o `videoId` só existe depois do fim do trabalho; o
vínculo deve ser aplicado **na reconciliação** (quando o vídeo real aparece),
não na resposta do 202.

**Aceite:** CRUD completo por Playwright; excluir coleção não reduz a
Biblioteca; esvaziar zera contagem e mantém vídeos; vínculo do Adicionar link
funciona ponta a ponta.

---

## 9. Preferências e componentes existentes

Preservar integralmente: painel horizontal Visualização (recolhível), colunas,
larguras arrastáveis, altura, fonte, Ampliado/Compacto, Markdown, preferências,
painel sobreposto e adaptação de miniaturas. A mudança de cor não pode alterar
nenhuma dessas regras; os testes existentes (`visualizacao`, `pos-f6`,
`miniatura`, `refinamentos`) são a rede de proteção e precisam continuar verdes
**sem edição de expectativa**, exceto onde a cor é o objeto.

---

## 10. Plano de execução (quatro partes, commits separados)

**A — Estados e feedback** (itens 2 e 4)
**B — Importações** (item 3) + extensão `DELETE /api/trabalhos/:id`
**C — Organização** (itens 6, 7, 8) + correções de contrato de coleção
**D — Confiabilidade e acabamento** (itens 1, 5 e regressão geral)

Cada parte: testes automatizados próprios, Playwright do comportamento,
`npm test` completo e atualização de `estado-atual.md` **no mesmo commit**.
Falha relevante em aberto impede avançar de parte.

---

## 11. Fora de escopo

F7 (chat/RAG), reescrita de módulos, dependências novas, migração destrutiva,
alteração do protótipo Python, `git push` para o repositório remoto sem
autorização, exclusão de vídeo como efeito de operação de coleção ou histórico.

## 12. Riscos declarados

- **Cor:** `--azul-forte` é usado em vários pontos como cor de ação; trocar o
  valor para claro exige revisar todo `color` sobre ele. Mitigação: token
  `--texto-sobre-primario` e varredura por `#fff` fixo.
- **Tabela de Importações:** troca de cartões por tabela muda o DOM que testes
  antigos possam consultar. Mitigação: manter ids/classes semânticas e rodar
  todas as suítes antes de commitar.
- **Árvore com vídeos:** risco de N+1 chamadas. Mitigação: uma chamada por
  página de 50, mesma consulta da Biblioteca.
- **Provisória × deduplicação:** duas fontes de verdade temporárias podem
  duplicar a linha. Mitigação: a provisória não é `Video`; a remoção acontece
  **antes** do `carregar()` que traz o registro real.
