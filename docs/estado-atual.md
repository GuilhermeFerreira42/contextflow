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
- O escopo canônico ainda enumera quatro telas e banco/ORM a definir; a SPEC
  F5-UI e a implementação usam três telas, leitura integrada e SQLite já decidido.
  Divergência registrada, sem renegociar nem reescrever escopo nesta revisão.
- A descrição antiga das capturas em `docs/mockups/evidencia/` afirma 5.000
  vídeos e 1.667 resumos, mas `biblioteca-com-resumos.png` exibe seis resultados.
  Essa captura não comprova o volume anunciado. O volume foi comprovado
  separadamente no E2E desta revisão; as métricas históricas de 1.667 resumos
  não foram reproduzidas.

Próxima ação: reconciliar os pontos documentais de produto com o proprietário e
homologar a F5-UI. F6 continua bloqueada pelo limite registrado nesta etapa;
não interpretar a sequência do plano mestre como nova autorização.

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
