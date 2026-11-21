# Handoff — transferência do ContextFlow V1 para o Codex

> **Atualização de 19/11/2026:** este é o handoff original, já executado nesta
> máquina. F3 corrigida em `c6b7db5`: 120 testes aprovados, 6 skips Windows,
> 17 E2E, build e fumaça OK; três vídeos reais importados. HTTP 429 na tradução
> automática pt, repetida com en-orig; privado não executado. F4 agora tem SPEC
> (`docs/specs/f4-trabalhos.md`) e nenhuma implementação. Para retomar, vale
> `docs/estado-atual.md`, que registra evidências, ressalvas e próximos gates.

> **Para o proprietário:** este arquivo é a mensagem de onboarding. Copie a
> seção "Mensagem para colar" e entregue ao Codex junto do repositório.
> **Para o Codex:** leia este arquivo inteiro antes de tocar em qualquer coisa.

---

## Mensagem para colar

Estou te passando o **ContextFlow V1**, um projeto que vem sendo desenvolvido por
outro agente. Você vai continuar o desenvolvimento e validar o processo na minha
máquina Windows. Antes de escrever qualquer código, leia os arquivos na ordem
abaixo — eles são a fonte de verdade e existem justamente para você não precisar
adivinhar nada.

**Leia nesta ordem:**

1. `docs/handoff-codex.md` — este arquivo: ambiente, comandos, o que falta.
2. `docs/00-comece-aqui.md` — mapa do projeto e regras de execução.
3. `docs/01-escopo-canonico.md` — o que entra e o que não entra na V1. **Não
   negocie escopo sem mim.**
4. `docs/estado-atual.md` — onde o trabalho parou, commit por commit.
5. `docs/07-protocolo-continuidade.md` — o protocolo vinculante (é curto e
   evita retrabalho).
6. `docs/specs/f3-ingestao.md` — a fatia mais recente, que você vai validar.
7. `docs/roteiro-teste-f3.md` — o teste que eu preciso que você execute.

**Sua primeira tarefa, nesta ordem:**

1. Rodar `npm install`, `npm test`, `npm run test:e2e` e `npm run verificar` em
   `platform/` e me dizer o resultado real de cada um. Não aceite "deve
   funcionar": quero a saída.
2. Executar `docs/roteiro-teste-f3.md` com o yt-dlp instalado: importar um vídeo
   com legenda manual, um só com automática e um sem legenda nenhuma. Isso é o
   que falta para homologar a F3.
3. Corrigir o que aparecer de errado — e me contar o que era.
4. Só depois disso, escrever `docs/specs/f4-trabalhos.md` (fila persistente,
   progresso, cancelamento, retry). **Não implemente a F4 antes da SPEC.**

**Regras que não são minhas preferências, são do projeto:**

- `contextflow/` é o projeto original em Python. **Somente leitura.** Nunca
  altere, mova ou apague.
- Nada de segredo, chave ou token no Git. Nunca.
- Não declare nada "pronto" sem evidência executada. Se não rodou, escreva
  "não executado" e diga por quê. Prefiro saber do buraco a descobrir depois.
- Uma fatia por commit, com mensagem dizendo o que foi validado.
- Ao final, atualize `docs/estado-atual.md`. É assim que a próxima sessão
  (humana ou agente) retoma sem te chamar.

---

## 1. O que é o projeto

Aplicativo **local** de biblioteca pessoal de vídeos do YouTube. Importa URLs,
guarda metadados, baixa **legendas com timestamps** e (mais adiante) gera
resumos com IA. Interface web servida pelo próprio processo, tema grafite escuro
com detalhes em azul. Três telas: Biblioteca, Importações e Configurações —
a leitura acontece dentro da Biblioteca (na linha e num painel sobreposto),
não numa tela à parte. Chat sobre o conteúdo é **V2** e está fora da V1.

Monólito modular em **Node.js 22 + TypeScript**, sem framework HTTP e **zero
dependência de produção**.

> **Sobre caminhos:** o projeto foi desenvolvido num ambiente Linux, então
> alguma documentação antiga usa `/home/user/...`. **No Windows do proprietário
> nada disso existe.** O projeto está em `C:\Users\Usuario\Desktop\contextflow\`
> e a pasta `Continuidade de Projeto` fica ao lado, no `Desktop`. Onde você ler
> um caminho absoluto, traduza para o lugar onde você colocou as pastas — o que
> importa é a relação entre elas, não o prefixo.

## 2. Estrutura física

```
contextflow/                        → projeto ORIGINAL em Python. Somente leitura.
contextflow/                       → repositório Git do projeto novo (é este)
├── .git/
├── docs/                           → documentação canônica
│   ├── 00-comece-aqui.md
│   ├── 01-escopo-canonico.md
│   ├── 02-investigacao-e-reuso.md
│   ├── 03-arquitetura-e-contratos.md
│   ├── 04-plano-mestre.md
│   ├── 05-criterios-de-aceite.md
│   ├── 06-continuidade-e-operacao.md
│   ├── 07-protocolo-continuidade.md
│   ├── estado-atual.md            ← sempre atualizar no fim
│   ├── handoff-codex.md           ← este arquivo
│   ├── roteiro-teste-f3.md
│   └── specs/
│       ├── f1-esqueleto.md
│       ├── f2-persistencia.md
│       └── f3-ingestao.md
└── platform/                      → TODO o executável
    ├── package.json  tsconfig.json  README.md
    ├── scripts/                   → dev, start, build, verificar
    ├── src/
    │   ├── motor/src/
    │   │   ├── nucleo/            → config, http, erros, log, estático
    │   │   ├── modulos/           → biblioteca, ingestao, trabalhos, resumos, configuracao
    │   │   ├── persistencia/      → banco.ts (único que conhece o driver), repositórios
    │   │   └── integracoes/       → ytdlp.ts, legendas.ts (processo externo + normalização)
    │   ├── interface/publico/     → HTML, CSS e JS puro servidos pelo motor
    │   └── compartilhado/         → tipos que atravessam a fronteira HTTP
    └── testes/
        ├── unidade/               → regra isolada
        ├── integracao/            → com banco real; rota HTTP real
        ├── e2e/                   → navegador real via CDP
        └── build.test.ts
```

## 3. Estado atual (não improvise sobre isto)

| Fase | Situação |
|---|---|
| **F1 — esqueleto modular** | ✅ concluída e **homologada** |
| **F2 — persistência e migração** | ✅ concluída e **homologada** (banco `node:sqlite`, zero deps) |
| **F3 — ingestão com yt-dlp** | 🟨 **concluída tecnicamente** (`7a215cc`); aguarda teste real do YouTube |
| **F4 — trabalhos e recuperação** | ⬜ próxima; **SPEC ainda não existe** |

**Commits:** `9fb9f32` (F1) · `8009009` (lockfile) · `4c02f6f` (F2) · `7a215cc` (F3).
Branch `main`, sem remote configurado.

## 4. Ambiente necessário

| Item | Versão / observação |
|---|---|
| Node.js | **≥ 22.5** (usa `node:sqlite` e type stripping nativo) |
| npm | o que vem com o Node |
| yt-dlp | qualquer versão recente; `winget install yt-dlp` ou `pip install -U yt-dlp` |
| Chrome/Edge | para o E2E; o script descobre sozinho, ou use `CHROME_BIN` |

**Não é necessário:** nenhum serviço extra, container ou servidor auxiliar.
O projeto é Node.js puro rodando na máquina — `npm start` sobe o servidor e o
navegador abre `http://127.0.0.1:4780`. Qualquer editor serve.

Sem dependência de produção. `npm install` instala só TypeScript e `@types/node`
(6 pacotes, ~0,4 s).

## 5. Comandos (a partir de `platform/`)

```bash
npm install            # uma vez
npm run dev            # desenvolvimento: roda TypeScript direto
npm start              # produção: roda dist/ (exige build antes)
npm run build          # typecheck + gera dist/
npm run typecheck      # só checagem de tipos
npm test               # 122 testes de unidade + integração
npm run test:e2e       # 17 cenários em navegador real
npm run verificar      # fumaça: sobe, responde, grava, lê
```

No Windows, `npm run test:e2e` deve achar o Chrome ou o Edge instalado. Se não
achar: `$env:CHROME_BIN = "C:\Program Files\Google\Chrome\Application\chrome.exe"`.

**6 testes são pulados no Windows** — são os que criam um binário falso baseado
em shell (`testes/integracao/ytdlp-processo.test.ts` e
`ytdlp-fake-binario.test.ts`). Isso é deliberado e está declarado em cada teste.
Se aparecer `# skipped 6`, está correto.

## 6. O que foi validado e o que não foi

**Validado no ambiente de origem (Linux):** typecheck limpo, 122/122 testes,
17/17 E2E em navegador real, build OK, fumaça OK, instalação em clone limpo,
persistência sobrevivendo a SIGKILL, injeção de comando bloqueada.

**Não validado — e é o motivo deste handoff:**

1. **Teste real contra o YouTube.** O ambiente de origem bloqueia o domínio
   (`TLS/SSL connection has been closed`). Os adaptadores foram testados com
   binário falso, que prova o contrato de processo mas não o conteúdo do
   YouTube. **Isto é o que o roteiro da F3 resolve.**
2. **Suíte completa em Windows.** O app já rodou no Windows do proprietário
   (`npm run dev`, importação, persistência), mas `npm test` nunca rodou lá.

## 7. Armadilhas conhecidas (perca menos tempo que nós)

| Armadilha | O que acontece | O que fazer |
|---|---|---|
| `npx tsc` sem `node_modules` | instala `tsc@2.0.4` falso e falha | use `npm run typecheck` |
| `better-sqlite3` | instala falhando: `node-gyp rebuild` baixa headers e quebra em Windows sem Build Tools | **não reintroduza**; a decisão por `node:sqlite` está fechada em `docs/specs/f2-persistencia.md` |
| Imports no fonte | usam `.ts`, não `.js` | `rewriteRelativeImportExtensions` resolve no build; não "corrija" para `.js` |
| `erasableSyntaxOnly` ativo | `enum`, `namespace`, parameter properties são **proibidos** | use união de literais e campos explícitos |
| Benchmark em pasta já instalada | npm reusa a árvore e não roda install script; a conclusão é falsa | valide sempre com clone limpo |
| `node --test` com glob | `"testes/**/*.test.ts"` precisa de aspas no script | já está no `package.json`; não mexa |

## 8. Decisões fechadas (não reabrir sem evidência nova)

1. **Banco: `node:sqlite`.** Reverter para `better-sqlite3` exige demonstrar
   instalação limpa funcionando em Windows sem toolchain. Já tentamos e falhou.
2. **Sem framework HTTP** (`node:http` + roteador próprio) e **sem framework de
   frontend** nesta fase.
3. **yt-dlp via `spawn` com array de argumentos e `shell: false`.** Sempre.
4. **Cursor keyset** (`criado_em`, `id`), não `OFFSET`.
5. **Busca por `LIKE`** até haver volume medido (F5).
6. **Sem Whisper na V1.** Se não há legenda, o estado é `indisponivel` — não se
   inventa transcrição.

## 9. Próxima fatia: F4

Escopo previsto em `docs/04-plano-mestre.md`: **fila persistente** com estados,
concorrência limitada, **cancelamento cooperativo**, **retry idempotente**,
progresso consultável e **importação de playlist** (que ficou de fora da F3
justamente por depender da fila).

Antes de codar: escrever `docs/specs/f4-trabalhos.md` seguindo o formato das
SPECs anteriores — objetivo, escopo, exclusões, contratos, fluxo, erros,
critérios numerados, testes previstos, riscos e definição de concluído.

O módulo `modulos/trabalhos/servico.ts` já declara a interface
(`criar`, `obter`, `listar`, `cancelar`) e está sem implementação. Respeite a
assinatura, ou justifique a mudança na SPEC.

## 10. Como saber que você terminou bem

- [ ] `npm test` verde no Windows (e a contagem relatada, com os 6 skips)
- [ ] `npm run test:e2e` com 17 cenários passando
- [ ] `npm run verificar` com "TUDO OK"
- [ ] Roteiro da F3 executado: 3 vídeos, resultados reais anotados
- [ ] O que falhou foi corrigido **ou** registrado como não executado com motivo
- [ ] `docs/estado-atual.md` atualizado com commit, evidências e próximo passo
- [ ] Nenhum arquivo de `contextflow/` alterado
- [ ] Nenhum segredo, banco ou `node_modules` commitado

## 11. Índice dos documentos (para não ler o que não importa)

| Documento | Leia quando |
|---|---|
| `00-comece-aqui.md` | sempre, primeiro |
| `01-escopo-canonico.md` | antes de duvidar do escopo ou propor algo novo |
| `02-investigacao-e-reuso.md` | só se precisar entender o app Python original |
| `03-arquitetura-e-contratos.md` | antes de tocar em arquitetura ou módulo novo |
| `04-plano-mestre.md` | para saber onde a fatia atual se encaixa |
| `05-criterios-de-aceite.md` | antes de dizer "está pronto" |
| `06-continuidade-e-operacao.md` | se for mexer na estrutura de pastas |
| `07-protocolo-continuidade.md` | sempre que for iniciar ou encerrar uma sessão |
| `estado-atual.md` | sempre, e **atualize no fim** |
| `handoff-codex.md` | este arquivo |
| `roteiro-teste-f3.md` | na primeira tarefa |
| `specs/f1..f3` | conforme a fatia que você for mexer |
| `platform/README.md` | para comandos e variáveis de ambiente |

## 12. Pendências técnicas já mapeadas

| # | Pendência | Quando |
|---|---|---|
| P1 | Importação de playlist | F4 |
| P2 | Lista de importações com progresso na UI | F4 |
| P3 | ~~Biblioteca sem virtualização~~ — resolvido na F5 | — |
| P4 | ~~Leitura com N+1~~ — a tela Leitura deixou de existir na F5-UI; o painel busca sob demanda | — |
| P5 | Busca por `LIKE`, sem FTS | F5, com volume medido |
| P6 | Configurações somente leitura | F8 |
| P7 | Nenhum resumo por IA | F6 |
