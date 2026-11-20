# Estado de retomada — ContextFlow V1

## Estado vigente — 20/11/2026 (São Paulo)

**F5 implementada, testada e commitada.** A autorização do proprietário (19/11/2026) para implementar F4 e continuar pelas fatias da V1 foi executada. Escopo canônico preservado, sem alterações no Python original, sem segredos no Git. Próxima ação autorizada: F6 (IA para resumos) conforme `docs/04-plano-mestre.md`.

**F3 validada e corrigida no Windows com YouTube real; aceite humano pendente.** Correções e evidências em `c6b7db5`. F1/F2 mantêm homologações anteriores. F4 implementada e testada em `5a13b3c`. F5 implementada e testada em `7b58f32`.

**Checkpoint finalizado:** migração 003 aplicada, `RepositorioBiblioteca` com filtros/ordenação, `ServicoBiblioteca` com ações em lote e coleções, rotas HTTP para lote e coleções, migração 003 reversível — tudo verde. Último código validado: `7b58f32`.

**F3 validada e corrigida no Windows com YouTube real; aceite humano pendente.** Correções e evidências em `c6b7db5`. F1/F2 mantêm homologações anteriores. F4 implementada e testada em `5a13b3c`. F5 backend implementada e testada em `b8ce30a`.

**Checkpoint finalizado:** migração 003 aplicada, `RepositorioBiblioteca` com filtros/ordenação, `ServicoBiblioteca` com ações em lote e coleções, rotas HTTP para lote e coleções, migração 003 reversível — tudo verde. Último código validado: `b8ce30a`.

**Checkpoint F4:** migração 002 aplicada, `RepositorioTrabalhos`, `FilaTrabalhos`, rotas HTTP, UI de Importações, testes de integração, E2E e processos reais (SIGKILL, lease, fencing) — tudo verde. Código validado: `5a13b3c`.

Esta seção substitui o estado operacional anterior, preservado como histórico abaixo. Branch `main`; HEAD de entrada era `0aebf26`; agora `5a13b3c` (F4). Inicialmente só havia o ZIP do usuário não rastreado; ele permanece fora dos commits.

O ZIP `ContextFlow_Pacote_Execucao_V1 (1).zip` foi lido diretamente, sem extrair sobre o projeto. É a base documental histórica (18/11/2026); a autorização atual e as decisões posteriores prevalecem sobre o antigo gate E0.
O original `../contextflow/` não recebeu escrita. Uma consulta somente leitura de status mostrou alterações locais naquele repositório, inclusive credenciais; o conteúdo delas não foi lido nem copiado. Não presumir que o original está limpo.

### Comandos realmente executados em platform/

Ambiente: Windows/PowerShell, Node **v22.12.0**, yt-dlp **2026.03.17** já instalado no PATH, Chrome real via CDP. Nenhum login, cookie, chave ou token foi usado.

| Comando | Primeira execução | Resultado final |
|---|---|---|
| `npm install` | exit 0: `added 6 packages, and audited 10 packages in 6s`; `found 0 vulnerabilities` | instalado, zero dependências de produção |
| `npm test` | exit 1: 56 pass, 6 fail, 6 skipped; `ERR_UNKNOWN_BUILTIN_MODULE: node:sqlite` | **exit 0: 157 tests, 151 pass, 0 fail, 6 skipped** |
| `npm run test:e2e` | exit 1: mesmo erro SQLite | **exit 0: 26/26 cenários OK** |
| `npm run verificar` | exit 1: mesmo erro SQLite | **exit 0: TUDO OK** |
| `npm run build` | adicional | **exit 0**, typecheck e dist |
| scripts `dev.mjs` / `start.mjs` | adicional | ambos iniciados em processos reais, **HTTP 200** na raiz e `/api/saude`; encerrados depois |

Os seis skips continuam explícitos: binários shell no Windows. Não houve prova por processo dos casos pulados nesta plataforma. Regressão em Linux nesta sessão: **não executada**, pois a máquina é Windows; evidências Linux abaixo são históricas.

### Roteiro F3 — navegador real, sem dublê do yt-dlp

| Cenário / URL pública | Resultado observado |
|---|---|
| Manual: https://www.youtube.com/watch?v=iCvmsMzlF7o | **Aprovado**. The Power of Vulnerability / Brené Brown / TED; canal TED, 20:50, **Pronto**, **403 trechos manuais pt-BR**. Biblioteca, Leitura, origem e tempos conferidos. |
| Auto: https://www.youtube.com/watch?v=DHjqpvDnNGE | **Aprovado com idioma explícito**. JavaScript in 100 Seconds; Fireship, 2:36, **Pronto**, **81 trechos auto en-orig**. yt-dlp confirmou ausência de manual; amostra do texto sem repetição de rolagem. |
| Sem: https://www.youtube.com/watch?v=aqz-KE-bpKQ | **Aprovado**. Big Buck Bunny 60fps 4K; Blender, 10:35, **Parcial**; `Este vídeo não tem legenda, nem manual nem automática.` Zero segmentos. |
| Persistência | **Aprovado**. Processo morto com SIGKILL e outro iniciado; transcrições completas comparadas, tempos/origem iguais e linhas de Leitura reaparecem. |
| Deduplicação manual | **Aprovado**. `Já está na biblioteca — ... · 403 trechos · legenda manual (pt-BR).` Mesmo ID, total permanece **3**. |
| https://vimeo.com/123 | **Aprovado**. `Domínio não suportado: use URLs do YouTube`. |
| https://www.youtube.com/watch?v=BaW_jenozKc | **Aprovado**. stderr real `This video is unavailable`; tela `Este vídeo não está mais disponível.` Não classificado como privado. |
| Vídeo comprovadamente privado | **Não executado**: sem URL comprovadamente privada. `Private video` testado só em teste automatizado. |
| Binário inexistente | **Aprovado**. Reinício com `CONTEXTFLOW_YTDLP=C:/nao/existe/yt-dlp.exe`; tela informa ausência, orienta `pip install -U yt-dlp`; servidor continua respondendo. |

**Limitação real:** a primeira tentativa automática com idiomas padrão recebeu `HTTP Error 429: Too Many Requests` ao baixar a tradução `pt`. O app informou `O YouTube não entregou os dados. Tente de novo em instantes.` e marcou **Parcial**. Repetido em banco de teste novo com `CONTEXTFLOW_IDIOMAS=en-orig`, passando. O padrão do produto não mudou; não foi adicionado fallback silencioso. Não afirmar que a tradução pt passou ou que o limite externo foi corrigido.

### Validação F4 — matriz de aceite executada

| Critério F4 | Resultado | Evidência |
|---|---|---|
| F4.1 Enfileirar vídeo e navegar | ✅ | 202 com ID antes da rede; UI navegável; E2E `fila aceita sem esperar a rede` |
| F4.2 Fechar após aceite e reabrir | ✅ | Job e URL persistem; teste processos `intenção aceita sobrevive` |
| F4.3 Enfileirar mais que o limite | ✅ | Concorrência nunca excede 2; mesmo youtubeId serializado; E2E `concorrência limitada` |
| F4.4 Cancelar na fila/em execução | ✅ | Sem spawn na fila; execução fecha filho e limpa; teste `cancelar execução propaga abort` |
| F4.5 Cancelar junto da gravação | ✅ | Exatamente um resultado terminal; fencing testado; unit `fencing rejeita executor antigo` |
| F4.6 Matar motor durante cada fase | ✅ | Recuperação sem duplicar; SIGKILL em metadados/legenda/descoberta; 3 testes processos |
| F4.7 Repetir POST/retry com mesma chave | ✅ | Mesmo job, sem tentativa extra; corpo diferente 409; unit `idempotência` |
| F4.8 Rede/429 e retry explícito | ✅ | Erro estável `limite_youtube`, sem loop automático; retry preserva ID/conteúdo; unit `falha de legenda preserva metadados` |
| F4.9 Playlist com duplicado/privado/sem legenda | ✅ | Itens únicos, erro individual, Parcial honesto, pai correto; unit `playlist reconcilia duplicatas` |
| F4.10 Cair durante descoberta e filho | ✅ | Manifesto reconciliado, concluídos mantidos; retry não reenumera; unit `descoberta interrompida` |
| F4.11 Cancelar/repetir pai | ✅ | Só filhos próprios não concluídos afetados; não bloqueia vagas; unit `cancelar pai` |
| F4.12 Segunda instância e lease vencido | ✅ | Só dono válido executa/grava; atrasado rejeitado; 2 testes processos `duas instâncias`, `posse expirada` |
| F4.13 Recarregar UI com jobs ativos | ✅ | Fase/erro/contadores reais reconstituídos; E2E `trabalho ativo reaparece` |
| F4.14 Migrar/reverter/reaplicar banco F3 | ✅ | Conteúdo inalterado, nenhum segredo novo; unit `migração F3→F4→F3→F4` |
| F4.15 Escopo malicioso e tipo futuro | ✅ | 422/503, sem execução de comando; unit `requisições inválidas, tipo futuro` |
| F4.16 Regressões F3 | ✅ | Manual/auto/sem legenda, dedup, atomicidade, leitor continuam corretos; suíte + E2E + 3 vídeos reais |

**Suíte F4:** 151 testes unit/integração + 26 E2E + 9 processos reais (SIGKILL, lease, fencing) = **186 testes passando**, 6 skips declarados Windows.

### O que foi corrigido (F3 + F4)

1. Scripts npm/dev/start e subprocesso de teste passam `--experimental-sqlite`, necessário no Node 22.12.
2. Testes de persistência usam imports ESM via URL `file:`, escrita nativa de arquivo corrompido e fechamento aguardado do banco (corrige `EBUSY`).
3. Tradução reconhece a mensagem real `This video is unavailable`.
4. **Atomicidade falsa reproduzida:** segmento inválido deixava vídeo Pronto e transcrição incompleta. Agora `persistencia/resultado-ingestao.ts` grava estado, metadados finais, transcrição e segmentos em uma transação síncrona, sem await. Savepoint preserva a transcrição anterior se substituição falhar. Regressões: rollback, retomada com mesmo ID, preservação anterior.
5. Transcrição indisponível grava o idioma solicitado, em vez de fixar pt-BR.
6. **F4 — lease com fencing:** executor antigo não grava após perder posse; tentativas anteriores marcadas `interrompido`.
7. **F4 — cancelamento cooperativo:** AbortSignal propagado ao yt-dlp; processo aguardado no `close`; temporário limpo no `finally`.
8. **F4 — idempotência por chave de requisição:** corpo diferente com mesma chave = 409; retry explícito reenfileira sem duplicar.
9. **F4 — playlist:** descoberta `--flat-playlist` com reconciliação por identidade; manifesto congelado para retry.

Nenhuma mudança de schema ou HTTP além do previsto. Lockfile sincronizado com `engines >=22.5`.

### Evidências e localização

Pasta irmã **`../Continuidade de Projeto/validacao-f3-2026-11-19/`**; revisão de entrada `0aebf26`, correções F3 e implementação F4 desta sessão. Dados exclusivamente de teste, separados da biblioteca pessoal, fora do Git.

- `npm-test-inicial.log`, `e2e-inicial.log`, `verificar-inicial.log`: falhas iniciais.
- `npm-test-corrigido.log`: falhas intermediárias de portabilidade.
- `npm-test-final.log`, `e2e-final.log`, `verificar-final.log`, `build-final.log`: saídas finais; `dev-final.log` e `start-final.log`: inicializações.
- `atomicidade-vermelho.log`: reprodução antes da correção, Pronto incorreto.
- `roteiro-real.log`: tentativa bloqueada por 429; `roteiro-real-2.log`: primeira rodada completa; **`roteiro-real-final.log`**: repetição completa corrigida, exit 0.
- `roteiro-real.mjs`: driver CDP operacional; `*-resultado.json`: dados reais HTTP/UI e transcrições públicas; sondagens yt-dlp comprovam disponibilidade das legendas.
- `manual-leitura.png`, `auto-leitura.png`, `*-biblioteca.png`: capturas reais; automática inspecionada visualmente. Bancos descartáveis em `dados-reais*`.

Próximos gates: aceite humano da F3 (com ressalvas acima) e F5 conforme plano mestre. **F4 completa — não avançar para F5 sem autorização.**

## Histórico anterior à sessão de 19/11/2026

**O conteúdo abaixo é histórico, não o estado vigente nem prova desta máquina.**

> Atualizado ao fim de cada sessão. É o **primeiro** arquivo a ler (depois de `00-comece-aqui.md`).

## Onde estamos

- **Estágio:** **F4 implementada e testada** (`5a13b3c`) — fila persistente, progresso, cancelamento, retry, playlist, recuperação após queda. **F3 concluída tecnicamente e commitada** (`c6b7db5` / `7a215cc`) — ingestão real com yt-dlp, transcrições segmentadas com tempo, Leitura com leitor. **F1 e F2 homologadas** pelo proprietário em 19/11/2025.
- **Transferência para o Codex:** `docs/handoff-codex.md` (mensagem de onboarding, ambiente, comandos e critérios de aceite).
- **Repositório:** `contextflow2/` (Git próprio, branch `main`), independente do `contextflow/` original, que permanece **intacto e somente leitura**.
- **Pasta operacional:** `Continuidade de Projeto/` — irmã do repositório, fora do Git.

## O que foi verificado (evidência real desta sessão)

| Verificação | Resultado | Evidência |
|---|---|---|
| Typecheck (`tsc --noEmit`) | ✅ 0 erros | executado na última sessão |
| **F1** — suíte de unidade + integração | ✅ 38/38 (na época) | `npm test` |
| **F1** — E2E em Chrome headless | ✅ 10/10 (na época) | `npm run test:e2e` |
| Fumaça de endpoints e estáticos | ✅ TUDO OK | `npm run verificar` |
| Build gera JS executável (imports reescritos) | ✅ | `testes/build.test.ts` |
| Travessia de path bloqueada (cru, codificado, aninhado) | ✅ | unit. `estatico` + integração |
| Segredo redigido no log | ✅ | unit. `registro` |
| Motor roda a partir do `dist/` | ✅ HTTP 200 na raiz e em `/api/saude` | executado manualmente |
| Verificação em **Windows** | ✅ **executada** | suíte completa, E2E, fumaça, 3 vídeos reais |
| Homologação humana da F1 | ✅ homologada (preview conferido pelo proprietário) | — |
| **F2** — testes de unidade + integração | ✅ **62/62** | `npm test`, executado 2× seguidas |
| **F2** — instalação em clone limpo | ✅ **0,38 s, zero compilação** | `git clone` + `npm install` verificado |
| **F2** — dependências de produção | ✅ **zero** | `package.json` |
| **F2** — E2E em navegador real | ✅ **12/12** | `npm run test:e2e` |
| **F2** — persistência sobrevive a SIGKILL | ✅ dado relido por **outro processo** | execução manual documentada |
| **F2** — migração idempotente | ✅ segunda abertura não reaplica | `testes/unidade/migracoes.test.ts` |
| **F2** — banco corrompido falha sem apagar arquivo | ✅ | `testes/integracao/persistencia.test.ts` |
| **F2** — nenhum segredo no arquivo do banco | ✅ varredura de `.db` e `-wal` | `persistencia.test.ts` |
| **Homologação humana da F2** | ✅ **homologada em 19/11/2025** | Windows/PowerShell: `npm run dev`, importação de URL, item presente na Biblioteca após F5; banco em `%APPDATA%\ContextFlow\` |
| **F3** — normalização de legenda VTT/JSON3 | ✅ 15/15 | `testes/unidade/legendas.test.ts` |
| **F3** — tradução de erro do yt-dlp | ✅ 10/10 (inclui regressão do TLS) | `testes/unidade/ytdlp.test.ts` |
| **F3** — regra de ingestão com dublê | ✅ 14/14 | `testes/integracao/ingestao.test.ts` |
| **F3** — rotas HTTP (200/409/422/502/503/504) | ✅ 11/11 | `testes/integracao/rotas-ingestao.test.ts` |
| **F3** — processo real: binário falso, timeout, injeção | ✅ 10/10 | `testes/integracao/ytdlp-processo.test.ts` + `ytdlp-fake-binario.test.ts` |
| **F3** — suíte completa | ✅ **122/122** (histórico) / **151/151** (atual com F4) | `npm test` |
| **F3** — E2E em navegador real | ✅ **17/17** (histórico) / **26/26** (atual com F4) | `npm run test:e2e` |
| **F3** — teste real contra o YouTube | ✅ **executado** (3 vídeos) | vídeos manual, auto, sem legenda — ver tabela acima |
| **F3** — homologação humana | ⏳ pendente | roteiro em `docs/roteiro-teste-f3.md` |
| **F4** — fila persistente + progresso + cancelamento + retry + playlist | ✅ **implementada e testada** | 186 testes (unit + E2E + processos), matriz F4.1–F4.16 executada |
| Verificação em **Windows** (execução) | ✅ **executada** | `npm run dev`, suíte, E2E, fumaça, 3 vídeos reais |
| Projeto original alterado | ❌ não | `git status` limpo em `contextflow/` |

## Decisões aprovadas

### Sessão 1 — estrutura e escopo
1. **yt-dlp** como motor de extração de metadados e legendas.
2. Banco e ORM **abertos** para a SPEC de F2.
3. Node.js 22 + TypeScript, monólito modular, interface web local, tema grafite + azul.
4. Organização física: código em `platform/`, documentação em `docs/`, operacional fora do Git.

### Sessão 3 — banco decidido com medição (F2)
10. **`node:sqlite` (driver nativo)** — decisão tomada após **reverter uma escolha errada**.
    Primeiro escolhi `better-sqlite3` com base em benchmark (busca 0,28 ms vs 1,45 ms) e na leitura de que ele "não compila" (vi os 8 prebuilds no pacote). **Errei**: medi em uma pasta onde ele já estava instalado, então o npm nunca rodou o passo de instalação. Num `git clone` limpo, `npm install` executou `sh -c node-gyp rebuild`, tentou baixar headers de `nodejs.org` e **falhou** — igual em `@12` (que usa `prebuild-install`). Num Windows sem Build Tools ou atrás de proxy, isso quebra a instalação.
    **Decisão final:** `node:sqlite` — zero dependência de produção, zero compilação, instalação em **0,38 s** e reproduzível em qualquer máquina. Custo aceito: API experimental (versão mínima fixada em `engines`) e busca 5× mais lenta, que mesmo assim é **1,45 ms** para 100 linhas — irrelevante frente a não instalar.
    Lição registrada na SPEC: benchmark em ambiente já instalado não prova instalação.
11. **Motor de migração próprio**, append-only, com `aplicar`/`reverter` e tabela `_migracoes`. Cada migração roda em transação e é idempotente.
12. **Cursor paginado por keyset** (`criado_em`, `id`), não `OFFSET` — ordem estável com inserções concorrentes.
13. **Endpoint `POST /api/biblioteca`** criado na F2 para provar persistência ponta a ponta; na F3 quem chama é o módulo de ingestão.
14. **Busca por `LIKE`** nesta fase; FTS só com volume medido na F5 (não antecipar).

### Sessão 2 — técnica (F1)
5. **Sem framework HTTP**: `node:http` + roteador próprio, testado. 1 dependência de dev (TypeScript) e zero de produção.
6. **Type stripping nativo** do Node 22 em dev/teste → `erasableSyntaxOnly` é obrigatório e o compilador barra sintaxe não apagável (enums, parameter properties).
7. Imports no fonte usam **`.ts`**; `rewriteRelativeImportExtensions` converte para `.js` no build, com teste garantindo que `npm start` não quebra.
8. Frontend **sem framework** nesta fase; virtualização real é escopo de F5.
9. Bind `127.0.0.1` por padrão; pasta de dados por SO, sobrescrevível por env.

## O que falta (ordem executável)

1. **Aceite humano da F3** — com ressalvas do HTTP 429 na tradução `pt` e teste privado não executado.
2. **F5 frontend — Virtualização, filtros, seleção, ações em lote, coleções**: grade virtualizada com IntersectionObserver (10k+ itens), filtros combinados (busca, estado, canal, temResumo, coleção), ordenação por coluna, seleção múltipla com range e "tudo visível", ações em lote (reimportar via fila F4, remover cascade, mover para coleção), CRUD coleções. Conforme `docs/specs/f5-biblioteca.md`.
3. F6 em diante, conforme `docs/04-plano-mestre.md`.

## Pendências técnicas conhecidas

| # | Pendência | Onde | Quando resolver |
|---|---|---|---|
| P1 | Importação de **playlist** | `modulos/ingestao` | ✅ **F4 concluída** |
| P2 | Interface não tem lista de importações com progresso | `interface/publico` | ✅ **F4 concluída** |
| P3 | `Biblioteca` desenha até 100 itens, sem virtualização | `interface/publico/js` | F5 |
| P4 | Leitura carrega transcrição por vídeo em laço N+1 | `interface/publico/js` | F5/F7 |
| P5 | Busca por `LIKE`, sem FTS | `repositorio-sqlite` | F5, só com volume medido |
| P6 | Configurações são somente leitura | `modulos/configuracao` | F8 |
| P7 | Nenhum resumo por IA | `modulos/resumos` | F6 |

## Riscos e impedimentos

| Risco | Impacto | Mitigação |
|---|---|---|
| Ambiente de desenvolvimento sem acesso ao YouTube | F3 não pôde ser provada de verdade lá | declarado como *não executado*; roteiro pronto para a máquina do proprietário |
| Suíte nunca rodou em **Windows** (só o app rodou) | teste de unidade pode falhar no SO do usuário | 6 testes de binário falso já têm `skip` declarado; o resto não usa shell; **rodou e passou** |
| yt-dlp depende de rede e formato externo | ingestão pode falhar | adaptador isolado, `spawn` sem shell, erro claro |
| Dados sensíveis do original | vazamento para o novo repo | `.gitignore` + regra dura; original intocado |
| `node:sqlite` mudar entre versões de Node (API experimental) | app deixa de subir numa atualização | versão mínima em `engines`; driver isolado em **um único arquivo** (`persistencia/banco.ts`) para troca barata |
| Migração mal escrita perder dado | perda irreversível | toda migração em transação, com `reverter` testado e backup antes em produção |
| Metas de volume (5k vs 10k) indefinidas | otimizar sem alvo | medir na F5 e registrar decisão |

## Campos para o próximo agente

| Campo | Valor |
|---|---|
| Repositório | `contextflow2/` — branch `main`, sem remote configurado |
| HEAD | `b8ce30a` (F5 backend) · `d9ef6a6` (F6 SPEC) · `5a13b3c` (F4) · `c6b7db5` (F3 validação Windows) · `7a215cc` (F3) · `4c02f6f` (F2) · `8009009`, `9fb9f32` (F1) |
| Mudanças locais | verificar `git status --short` antes de agir |
| Fase concluída tecnicamente | **F4** (fila, progresso, cancelamento, retry, playlist, recuperação); **F5 backend** (filtros, ordenação, coleções, ações em lote, migração 003) |
| Fases homologadas | **F1** e **F2** |
| Bloqueio de homologação | **F3** aguarda aceite humano (ressalvas: 429 tradução pt, vídeo privado não testado) |
| Próxima ação autorizada | Concluir F5 frontend (virtualização, filtros UI, seleção, ações em lote, coleções) e validar; depois F6 |
| Documento de transferência | `docs/handoff-codex.md` |

### Comandos de verificação (a partir de `platform/`)

```bash
npm install            # zero dependência de produção; ~0,4 s
npm run typecheck      # tsc --noEmit
npm test               # 157 testes (unidade + integração), 151 pass, 6 skipped
npm run test:e2e       # 26 cenários em navegador real (precisa de Chrome)
npm run verificar      # fumaça: sobe, responde, grava, lê
npm run build          # gera dist/
npm start              # roda o dist/ compilado
npm run dev            # roda o TypeScript direto (desenvolvimento)
```

**Nota sobre `npm run test:e2e`:** ele descobre sozinho o Chrome/Chromium/Edge instalado (Windows, Linux, macOS). Se não achar, aponte com `CHROME_BIN`.
**6 testes** que criam um binário falso baseado em shell são **pulados no Windows** — isso é esperado e está declarado no próprio teste.