# Estado de retomada — ContextFlow V1

> Atualizado ao fim de cada sessão. É o **primeiro** arquivo a ler (depois de
> `00-comece-aqui.md`).

## Onde estamos

- **Estágio:** **F1 concluída tecnicamente** (esqueleto modular rodando e verificado).
  Documentação canônica instalada. **Homologação humana da F1: pendente.**
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
| Homologação humana da F1 | ⏳ pendente | — |
| Projeto original alterado | ❌ não | `git status` limpo em `contextflow/` |

## Decisões aprovadas

### Sessão 1 — estrutura e escopo
1. **yt-dlp** como motor de extração de metadados e legendas.
2. Banco e ORM **abertos** para a SPEC de F2.
3. Node.js 22 + TypeScript, monólito modular, interface web local, tema grafite + azul.
4. Organização física: código em `platform/`, documentação em `docs/`, operacional fora do Git.

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

1. **Homologação humana da F1** — abrir a interface e confirmar navegação/visual.
2. **SPEC de F2 — Persistência e migração**: decidir **banco e ORM com evidência**
   (candidatos a comparar: `node:sqlite` nativo vs. `better-sqlite3` vs. arquivo JSON;
   a decisão precisa considerar instalação em Windows sem compilador).
3. F3 — Ingestão/legendas com yt-dlp (adaptador com testes de contrato + teste real).

## Riscos e impedimentos

| Risco | Impacto | Mitigação |
|---|---|---|
| Sem ambiente Windows | aceite cross-platform não provável aqui | registrar *não executado*, entregar roteiro; não declarar pronto |
| yt-dlp depende de rede e formato externo | ingestão pode falhar | adaptador isolado, `spawn` sem shell, erro claro |
| Dados sensíveis do original | vazamento para o novo repo | `.gitignore` + regra dura; original intocado |
| `better-sqlite3` exigir compilação no Windows | instalação difícil para o usuário | comparar com `node:sqlite` na SPEC de F2 antes de escolher |
| Metas de volume (5k vs 10k) indefinidas | otimizar sem alvo | medir na F5 e registrar decisão |

## Campos para o próximo agente

- Repositório/branch/HEAD: `contextflow2/`, `main` — ver `git log -1`
- Mudanças locais existentes: verificar `git status` antes de agir
- Fase em andamento e autorização: **F1 fechada tecnicamente; próxima é a SPEC de F2**
- Próxima ação autorizada: escrever `docs/specs/f2-persistencia.md` (decisão de banco
  com evidência) — **não** implementar antes da aprovação da decisão de banco
- Como verificar o que já existe: `cd platform && npm install && npm test && npm run verificar`
