# SPEC F5 — Biblioteca: virtualização, busca, performance

**Status:** rascunho para revisão. Não implementada.

### Retomada de 20/11/2026 — diferenças confirmadas e correção autorizada

O código de entrada é `d3b42d1`, não o HEAD antigo indicado no estado. Backend
parcial e estilos existem; a virtualização/controles ainda não estão ligados.
Três regressões foram reproduzidas: cursor por título retornou apenas 3 de 8
vídeos; remover apenas marcou erro; reimportar não criou trabalho. A suíte antiga
passa, mas não cobria esses cenários. A continuidade de implementação da V1 já
foi autorizada pelo proprietário; corrigir esses contratos antes de ligar a UI.

- Preservar migração 003 já commitada. Se necessário corrigir/backfill dos campos
  derivados, usar migração append-only, sem reescrever histórico aplicado.
- `colecao_videos` é a fonte de verdade dos vínculos e `resumos` é a fonte do badge.
  Os campos denormalizados são somente projeções mantidas pelo banco; ingestão
  não pode sobrescrevê-los com cópias antigas. Filtro por coleção usa vínculo exato,
  não substring de JSON. SQL permanece na persistência/repositórios.
- Cursor deve obedecer a coluna/direção selecionada e desempate estável, inclusive
  valores nulos. A resposta inclui total filtrado, não apenas total da biblioteca.
- Reimportar reaproveita fila F4 com grupo/lote e chave de requisição; preservar
  transcrição pronta, retomar pendentes/falhas. Remover executa cascade real e
  cancela importações ativas daquele vídeo para impedir reaparecimento tardio.
- Seleção é por IDs; ações usam snapshot dos IDs confirmados, incluindo os que
  ficaram ocultos ao filtrar. Remoção exige confirmação também para lote pequeno.
- Virtualização limita linhas reais na viewport; paginação por cursor é separada
  da reciclagem do DOM. Medir 5.000 itens nesta máquina; alvos de 60 fps/200 ms são
  propostas da SPEC, não resultados executados ou limites de produto homologados.

## Objetivo

A Biblioteca deixa de desenhar até 100 itens de forma ingênua e passa a suportar **milhares de vídeos** com rolagem fluida, filtros combinados, seleção múltipla e ações em lote — tudo sem bloquear a UI e com persistência real validada na F2/F4.

Escopo canônico (01-escopo-canonico.md): *tabela densa/virtualizada, miniatura, título, canal, duração, data, estado, status de resumo, classificação por canal e playlist; pesquisa, filtros, ordenação, seleção múltipla e ações em lote consistentes. Coleções podem morar dentro da Biblioteca, sem aba própria no nível superior.*

## Base inspecionada e reuso

- **F2**: `videos` com índice `criado_em DESC`, `estado`, `canal_id`; cursor paginado por keyset (`criado_em`, `id`); busca por `LIKE` (1,45 ms em 10k).
- **F3**: transcrições e segmentos normalizados; estado `pronto` / `parcial` / `indisponivel` já persistido.
- **F4**: fila de importação com progresso, cancelamento, retry — a Biblioteca não bloqueia enquanto a fila roda.
- **Interface atual** (`platform/src/interface/publico/js/aplicacao.js`): `renderizarBiblioteca()` desenha todos os itens da página atual (limite 100) em tabela HTML simples; paginação por botões "Próxima/Anterior" usando cursor; sem seleção, sem ações em lote, sem agrupamento visual.

## Decisões técnicas propostas (para revisão)

| Decisão | Valor proposto | Motivo |
|---|---|---|
| Virtualização | **Lista virtualizada** com `IntersectionObserver` + DOM reciclado (sem canvas, sem framework) | rolagem 60 fps com 10k+ linhas; zero dependência; HTML nativo acessível; CSS `contain` isola pintura |
| Filtros | `busca` (LIKE título/canal), `estado` (pronto/parcial/erro/importando), `canalId`, `playlistId` (quando houver coleções), `temResumo` | combina com índices F2; `playlistId` prepara coleções sem aba própria |
| Ordenação | `criado_em DESC` (padrão), `titulo ASC`, `canal ASC`, `duracao ASC/DESC`, `estado ASC` | `criado_em` + `id` como tiebreaker garante estabilidade com inserts concorrentes |
| Seleção | checkbox por linha + "Selecionar tudo visível" (apenas itens renderizados); contador fixo no cabeçalho | "tudo" real exigiria cursor extra; visível cobre 99% dos casos sem custo |
| Ações em lote | **reimportar** (retry explícito na fila), **remover** (cascade no banco), **mover para coleção** (quando F8) | reusa `FilaTrabalhos.repetir()` e `RepositorioBiblioteca.remover()` — sem lógica nova no motor |
| Coleções | tabela `colecoes` + `colecao_videos` (F2 já tem); UI: dropdown "Mover para…" no cabeçalho da seleção | canônico diz "coleções dentro da Biblioteca, sem aba própria" |
| Performance alvo | rolagem suave a 60 fps com 5.000 itens; busca/filtro < 200 ms em 10k | medido em F2: `LIKE` 1,45 ms; virtualização elimina custo de DOM |
| Sem FTS por enquanto | FTS nativa do SQLite só se volume medido (> 20k) mostrar degradação real | decisão F2 mantida; FTS é `ALTER TABLE` + trigger, reversível |

## Contratos

### HTTP (ampliações não quebrantes)

| Rota | Entrada | Saída |
|---|---|---|
| `GET /api/biblioteca` | `busca`, `estado`, `canalId`, `playlistId`, `temResumo`, `ordenacao`, `cursor`, `limite` | `{itens, proximoCursor, total}` — `itens` inclui `canalNome`, `duracaoFormatada`, `estado`, `temResumo`, `colecaoIds` |
| `GET /api/biblioteca/:id` | — | vídeo completo + `transcricao` resumida + `resumo` se houver |
| `POST /api/biblioteca/lote` | `{acao: 'reimportar' \| 'remover' \| 'colecao', ids: string[], colecaoId?}` | `{processados: number, falhas: [{id, codigo, mensagem}]}` — idempotente por `ids` |
| `GET /api/colecoes` | — | `{itens: [{id, titulo, contagem}]}` |
| `POST /api/colecoes` | `{titulo}` | coleção criada |
| `POST /api/colecoes/:id/videos` | `{videoIds}` | vínculos criados (ignora duplicados) |
| `DELETE /api/colecoes/:id/videos/:videoId` | — | vínculo removido |

> **Nota**: `POST /api/biblioteca` (criação crua) continua existindo para testes e integrações; a UI usa `/api/ingestao/importar` (F3) e `/api/trabalhos` (F4).

### Compartilhado (novos campos)

```ts
export interface Video {
  // ... campos F2/F3
  colecaoIds?: string[];           // F5: IDs das coleções às quais pertence
  temResumo: boolean;              // F5: atalho para UI evitar join
}
export interface Colecao { id: string; titulo: string; contagem: number; }
export type AcaoLote = 'reimportar' | 'remover' | 'colecao';
```

### UI (comportamento observável)

- **Virtualização**: ao rolar, linhas fora da viewport (+/- 500px) são removidas do DOM; `IntersectionObserver` detecta necessidade e pede próxima página via cursor.
- **Filtros**: barra superior com input busca, select estado, select canal (preenchido dinamicamente dos itens visíveis + "Todos"), checkbox "Com resumo". Mudança de filtro reseta cursor e recarrega primeira página.
- **Ordenação**: clique no cabeçalho da coluna alterna ASC/DESC; ícone visual; estado persistido em `sessionStorage`.
- **Seleção**: checkbox na primeira coluna; shift+click seleciona range; contador "3 de 1.247 selecionados" fixo no topo; botões "Reimportar", "Remover", "Mover para coleção…" habilitados só com seleção não vazia.
- **Ação "Reimportar"**: enfileira `importar-video` para cada `id` com `chaveRequisicao` derivada (`reimportar-${id}-${timestamp}`) — idempotente, não duplica se já estiver na fila.
- **Ação "Remover"**: `DELETE` em lote no banco (cascade remove transcrições/segmentos/resumos); confirmação modal se > 5 itens.
- **Coleções**: dropdown "Mover para…" lista coleções existentes + "Nova coleção…"; cria coleção se necessário e vincula selecionados.

## Persistência e migração

**Migração 003** (append-only, transação, reversível):

```sql
-- campos novos em videos
ALTER TABLE videos ADD COLUMN colecao_ids TEXT DEFAULT '[]';  -- JSON array de IDs
-- índice para filtro por coleção (via LIKE no JSON array, suficiente para volume atual)
CREATE INDEX idx_videos_colecoes ON videos(colecao_ids);
-- coluna temResumo (denormalizada para UI evitar join)
ALTER TABLE videos ADD COLUMN tem_resumo INTEGER NOT NULL DEFAULT 0;
CREATE INDEX idx_videos_tem_resumo ON videos(tem_resumo);
```

- `tem_resumo` mantido por trigger ou aplicação: quando `resumos` insere/atualiza `estado='pronto'`, seta `1`; quando remove ou erro, seta `0`.
- `colecao_ids` atualizado em `POST /api/colecoes/:id/videos` e `DELETE` correspondente.
- Reversão: `DROP INDEX` + `ALTER TABLE ... DROP COLUMN` (SQLite suporta desde 3.35, Node 22 tem).

## Matriz de aceite da F5

| # | Cenário | Ação | Resultado observável | Evidência |
|---|---|---|---|---|
| F5.1 | Virtualização 5k itens | abrir Biblioteca com 5.000 vídeos no banco | rolagem 60 fps, memória estável, DOM < 150 nós `tr` simultâneos | E2E + DevTools performance |
| F5.2 | Filtro por busca | digitar termo no input busca | requisição com `busca`, resultados filtrados em < 200 ms | integração + E2E |
| F5.3 | Filtro por estado | selecionar "Parcial" no select estado | só vídeos `parcial` aparecem; cursor resetado | integração |
| F5.4 | Filtro por canal | selecionar canal no select canal | só vídeos daquele canal | integração |
| F5.5 | Filtro "Com resumo" | marcar checkbox | só vídeos com `tem_resumo=1` | integração |
| F5.6 | Ordenação por coluna | clicar cabeçalho "Título" | ASC depois DESC; ícone visual; estado salvo na sessão | E2E |
| F5.7 | Seleção individual | clicar checkbox de uma linha | contador "1 de N selecionados"; botões habilitados | E2E |
| F5.8 | Seleção range | shift+click segunda linha | range selecionado; contador atualizado | E2E |
| F5.9 | Seleção tudo visível | clicar "Selecionar tudo visível" | só itens renderizados marcados; contador reflete | E2E |
| F5.10 | Ação reimportar lote | selecionar 3, clicar "Reimportar" | 3 trabalhos enfileirados com chaves idempotentes; fila processa | integração + E2E |
| F5.11 | Ação remover lote | selecionar 2, clicar "Remover", confirmar | vídeos somem da Biblioteca; banco cascade remove filhos; total decrementa | integração + E2E |
| F5.12 | Coleções — criar | "Nova coleção…" no dropdown, digitar título | coleção aparece no dropdown; contagem 0 | integração |
| F5.13 | Coleções — mover | selecionar 5, "Mover para Coleção X" | 5 itens ganham `colecaoIds` com ID da X; dropdown mostra contagem 5 | integração |
| F5.14 | Coleções — remover vínculo | abrir coleção, remover 1 item | item sai da coleção; contagem decrementa; vídeo permanece na Biblioteca | integração |
| F5.15 | Persistência de seleção | selecionar, recarregar página (F5) | seleção **não** persiste (comportamento esperado — seleção é efêmera) | E2E |
| F5.16 | Regressão F2/F3/F4 | rodar suíte completa | 151+ testes passam; E2E 26/26; fumaça TUDO OK | `npm test && npm run test:e2e && npm run verificar` |

## Testes previstos

**Unidade**
- `biblioteca-virtualizacao.test.ts`: reciclagem de DOM, threshold IntersectionObserver, carga incremental.
- `biblioteca-filtros.test.ts`: composição de WHERE com múltiplos filtros, cursor reset, ordenação estável.
- `biblioteca-lote.test.ts`: idempotência de chaves `reimportar-*`, cascade remove, vínculo coleção único.

**Integração**
- `biblioteca-api.test.ts`: endpoints novos + paginação cursor com 500 itens.
- `biblioteca-colecoes.test.ts`: CRUD coleções, vínculos, contagens.
- `biblioteca-performance.test.ts`: seed 5k vídeos, medir `GET /api/biblioteca` p95 < 200 ms.

**E2E (CDP real)**
- Virtualização visual: scroll até item 3.000, conferir que título corresponde.
- Filtros combinados: busca "javascript" + estado "pronto" + canal "Fireship".
- Seleção + reimportar: 3 itens, botão, fila processa, Biblioteca atualiza.
- Seleção + remover: 2 itens, modal confirma, somem da tabela.
- Coleções: criar, mover, remover vínculo, contagens.

## Riscos e decisões pendentes

| Risco | Impacto | Mitigação |
|---|---|---|
| `LIKE` degradar acima de 20k | busca lenta, UX ruim | medir em F5; se p95 > 200 ms, FTS nativa (migração 004) |
| Virtualização quebrar acessibilidade | leitores de tela perdem itens | `aria-rowindex` dinâmico + `role="rowgroup"`; testar com NVDA/VoiceOver |
| Seleção "tudo" ambígua | usuário acha que selecionou 10k mas só pegou 100 | rótulo claro "Selecionar tudo visível (N desta página)"; ação "Selecionar todos (lento)" opcional futura |
| Coleções JSON array no `videos` | query `LIKE` frágil se formato mudar | normalizar para `video_colecoes` (N:N real) em F6 se volume justificar; migração reversível |

## Definição de concluído

- Todas as matrizes F5.1–F5.16 com evidência executada (logs, screenshots, métricas).
- Suíte completa verde (`npm test`, `npm run test:e2e`, `npm run verificar`).
- Virtualização validada com 5.000 itens reais (seed automatizado).
- Filtros, ordenação, seleção, ações em lote, coleções funcionando no fluxo real.
- Migração 003 aplicada, revertida, reaplicada — dados preservados.
- `docs/estado-atual.md` atualizado com commit, métricas, próximo passo.
- Commit próprio da F5.

---

**Precedência:** `01-escopo-canonico.md` > `03-arquitetura-e-contratos.md` > esta SPEC > `04-plano-mestre.md`.
