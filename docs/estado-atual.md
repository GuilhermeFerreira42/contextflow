# Estado de retomada — ContextFlow V1

> Atualizado ao fim de cada sessão. É o **primeiro** arquivo a ler (depois de
> `00-comece-aqui.md`).

## Onde estamos

- **Estágio:** **F3 concluída tecnicamente** (ingestão real com yt-dlp,
  transcrições segmentadas, leitura com tempo). **F1 e F2 homologadas** pelo
  proprietário em 19/11/2025.
  **Pendente da F3:** teste manual contra o YouTube — o sandbox desta sessão
  bloqueia o domínio (TLS encerrado). Roteiro pronto para o proprietário.
- **Repositório:** `contextflow2/` (Git próprio, branch `main`), independente do
  `contextflow/` original, que permanece **intacto e somente leitura**.
- **Pasta operacional:** `/home/user/Continuidade de Projeto/` (fora do Git).

## O que foi verificado (evidência real desta sessão)

| Verificação | Resultado | Evidência |
|---|---|---|
| Typecheck (`tsc --noEmit`) | ✅ 0 erros | executado |
| Suíte de unidade + integração | ✅ **38/38** | `npm test` |
| E2E em Chrome headless (navegador real) | ✅ **10/10** | `npm run test:e2e` |
| Fumaça de endpoints e estáticos | ✅ TUDO OK | `npm run verificar` |
| Build gera JS executável (imports reescritos) | ✅ | `testes/build.test.ts` |
| Travessia de path bloqueada (cru, codificado, aninhado) | ✅ | unit. `estatico` + integração |
| Segredo redigido no log | ✅ | unit. `registro` |
| Motor roda a partir do `dist/` | ✅ HTTP 200 na raiz e em `/api/saude` | executado manualmente |
| Verificação em **Windows** | ❌ **não executada** — ambiente é Linux | — |
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
| **F3** — suíte completa | ✅ **122/122** | `npm test` |
| **F3** — E2E em navegador real | ✅ **17/17** | `npm run test:e2e` |
| **F3** — teste real contra o YouTube | ❌ **não executado aqui** | sandbox bloqueia o domínio: `TLS/SSL connection has been closed` |
| **F3** — homologação humana | ⏳ pendente | roteiro em `docs/roteiro-teste-f3.md` |
| Verificação em **Windows** (execução) | ✅ **executado pelo proprietário** | `npm run dev` no PowerShell, porta 4780, log `persistência pronta` |
| Projeto original alterado | ❌ não | `git status` limpo em `contextflow/` |

## Decisões aprovadas

### Sessão 1 — estrutura e escopo
1. **yt-dlp** como motor de extração de metadados e legendas.
2. Banco e ORM **abertos** para a SPEC de F2.
3. Node.js 22 + TypeScript, monólito modular, interface web local, tema grafite + azul.
4. Organização física: código em `platform/`, documentação em `docs/`, operacional fora do Git.

### Sessão 3 — banco decidido com medição (F2)
10. **`node:sqlite` (driver nativo)** — decisão tomada após **reverter uma escolha errada**.
    Primeiro escolhi `better-sqlite3` com base em benchmark (busca 0,28 ms vs 1,45 ms) e na
    leitura de que ele "não compila" (vi os 8 prebuilds no pacote). **Errei**: medi em uma
    pasta onde ele já estava instalado, então o npm nunca rodou o passo de instalação. Num
    `git clone` limpo, `npm install` executou `sh -c node-gyp rebuild`, tentou baixar
    headers de `nodejs.org` e **falhou** — igual em `@12` (que usa `prebuild-install`).
    Num Windows sem Build Tools ou atrás de proxy, isso quebra a instalação.
    **Decisão final:** `node:sqlite` — zero dependência de produção, zero compilação,
    instalação em **0,38 s** e reproduzível em qualquer máquina. Custo aceito: API
    experimental (versão mínima fixada em `engines`) e busca 5× mais lenta, que mesmo
    assim é **1,45 ms** para 100 linhas — irrelevante frente a não instalar.
    Lição registrada na SPEC: benchmark em ambiente já instalado não prova instalação.
11. **Motor de migração próprio**, append-only, com `aplicar`/`reverter` e tabela
    `_migracoes`. Cada migração roda em transação e é idempotente.
12. **Cursor paginado por keyset** (`criado_em`, `id`), não `OFFSET` — ordem estável com
    inserções concorrentes.
13. **Endpoint `POST /api/biblioteca`** criado na F2 para provar persistência ponta a
    ponta; na F3 quem chama é o módulo de ingestão.
14. **Busca por `LIKE`** nesta fase; FTS só com volume medido na F5 (não antecipar).

### Sessão 2 — técnica (F1)
5. **Sem framework HTTP**: `node:http` + roteador próprio, testado. 1 dependência de dev
   (TypeScript) e zero de produção.
6. **Type stripping nativo** do Node 22 em dev/teste → `erasableSyntaxOnly` é obrigatório
   e o compilador barra sintaxe não apagável (enums, parameter properties).
7. Imports no fonte usam **`.ts`**; `rewriteRelativeImportExtensions` converte para `.js`
   no build, com teste garantindo que `npm start` não quebra.
8. Frontend **sem framework** nesta fase; virtualização real é escopo de F5.
9. Bind `127.0.0.1` por padrão; pasta de dados por SO, sobrescrevível por env.

## O que falta (ordem executável)

1. **Homologação humana da F2** — abrir a interface, importar duas URLs e confirmar que
   o vídeo continua na Biblioteca depois de fechar e abrir o app.
2. **SPEC de F3 — Ingestão/legendas**: adaptador yt-dlp (metadados + legenda manual/auto),
   normalização de segmentos com timestamps, estados `indisponivel` explícitos.
3. F4 — Fila persistente com cancelamento e retry.

## Riscos e impedimentos

| Risco | Impacto | Mitigação |
|---|---|---|
| Sem ambiente Windows | aceite cross-platform não provável aqui | registrar *não executado*, entregar roteiro; não declarar pronto |
| yt-dlp depende de rede e formato externo | ingestão pode falhar | adaptador isolado, `spawn` sem shell, erro claro |
| Dados sensíveis do original | vazamento para o novo repo | `.gitignore` + regra dura; original intocado |
| `node:sqlite` mudar entre versões de Node (API experimental) | app deixa de subir numa atualização | versão mínima em `engines`; driver isolado em **um único arquivo** (`persistencia/banco.ts`) para troca barata |
| Migração mal escrita perder dado | perda irreversível | toda migração em transação, com `reverter` testado e backup antes em produção |
| Metas de volume (5k vs 10k) indefinidas | otimizar sem alvo | medir na F5 e registrar decisão |

## Campos para o próximo agente

- Repositório/branch/HEAD: `contextflow2/`, `main` — ver `git log -1`
- Mudanças locais existentes: verificar `git status` antes de agir
- Fase em andamento e autorização: **F2 fechada tecnicamente; próxima é F3 (ingestão)**
- Próxima ação autorizada: escrever `docs/specs/f3-ingestao.md` antes de codar
- Como verificar o que já existe: `cd platform && npm install && npm test && npm run test:e2e && npm run verificar`
