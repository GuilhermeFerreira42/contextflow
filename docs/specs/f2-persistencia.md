# SPEC F2 — Persistência e migração

**Status:** decisão de banco **tomada com evidência**; implementação autorizada.
**Homologação humana: pendente.**

## Objetivo

A biblioteca deixa de viver em memória e passa a persistir de verdade: banco versionado
por **migrações**, repositórios com contrato estável, transações e teste que **reinicia a
aplicação** e prova que os dados sobreviveram. Migração de dados do app original fica
preparada mas só executa sobre base **sanitizada**, nunca sobre a base pessoal do usuário.

## Decisão de banco — medida, e depois CORRIGIDA por medição nova

> **Esta seção registra uma decisão revertida.** A primeira escolha foi
> `better-sqlite3`; ela se mostrou errada ao testar instalação em árvore limpa.
> O erro e a correção ficam registrados porque a lição vale mais que a conclusão.

### Primeira medição (incompleta — induziu ao erro)

Medições iniciais, Node 22.22.3, 10.000 vídeos:

| Critério | `node:sqlite` (nativo) | `better-sqlite3` 13.2.0 |
|---|---|---|
| Inserção de 10k (transação) | 43,7 ms | 45,9 ms |
| Busca filtrada (LIKE + estado, 100 linhas) | 1,45 ms | **0,28 ms** |
| Paginação por cursor (keyset) | 0,09 ms | 0,09 ms |
| Status | experimental | estável |
| Precisa compilar no `npm install`? | não | *achei que não* |

**Conclusão da primeira medição:** `better-sqlite3` (API estável + 5× mais rápido na busca).

**Por que estava errada:** testei em uma pasta onde ele **já estava instalado**. O `npm`
reaproveitou a árvore existente e nunca executou o passo de instalação. Um `git clone`
limpo (`/tmp/cfclone`) revelou o contrário: `npm install` rodou `sh -c node-gyp rebuild`
e tentou baixar headers de `nodejs.org` → **falhou**. O mesmo aconteceu com
`better-sqlite3@12` (que usa `prebuild-install`, também dependente de download externo).

**Causa raiz:** o tarball publicado **contém** os 8 prebuilds (`win32-x64`, `win32-arm64`,
`linux-x64`, `linux-arm64`, `linuxmusl-*`, `darwin-*`), mas o carregamento depende do
mecanismo de resolução do pacote. Quando ele não encontra o binário correspondente, cai
no `node-gyp rebuild` — que exige **toolchain C++ e acesso a `nodejs.org`**. Num Windows
sem Visual Studio Build Tools, ou atrás de proxy corporativo, isso quebra o
`npm install`. Some-se a isso o risco de ABI entre versões de Node.

### Decisão final: `node:sqlite` nativo

| Critério | `node:sqlite` | `better-sqlite3` |
|---|---|---|
| Instalação limpa (o teste que reprovou a outra) | ✅ **zero dependência, zero compilação** | ❌ node-gyp + headers externos |
| Funciona em Windows sem toolchain | ✅ por construção | ❌ depende de prebuild compatível |
| Dependências de produção | **zero** | 2+ |
| Status da API | experimental (`ExperimentalWarning`) | estável |
| Busca filtrada 10k | 1,45 ms | 0,28 ms |

**Escolhido `node:sqlite`.** A performance é 5× pior na busca, mas **1,45 ms continua
irrelevante** para uma consulta que devolve 100 linhas — e instalação que funciona em
qualquer máquina é requisito de produto, não preferência técnica. Um aplicativo local
que o usuário não consegue instalar não tem valor por ser 1 ms mais rápido.

**Riscos aceitos e mitigação:**

| Risco | Mitigação |
|---|---|
| API experimental pode mudar entre versões de Node | versão mínima fixada em `engines` (`>=22.5`); adaptador isolado em **um único arquivo** (`persistencia/banco.ts`) |
| Aviso `ExperimentalWarning` no console | suprimido de forma explícita no `dev`/`start`/testes, não escondido |
| Busca `LIKE` degradar com volume | medido 10k; se F5 mostrar problema, FTS com evidência (nativa, sem dependência) |

**Alternativa rejeitada** (`better-sqlite3`): reavaliar somente se (a) o produto passar a
exigir escrita de altíssimo volume e (b) houver evidência de que a instalação em Windows
sem toolchain está resolvida no pacote.

## Escopo

- Conexão única, `WAL`, `foreign_keys = ON`, `synchronous = NORMAL`.
- **Motor de migrações próprio**, versionado por tabela `_migracoes`, aplicado em
  transação, idempotente e com `rollback` documentado por migração.
- Repositórios reais substituindo o de memória, **sem mudar o contrato** da F1.
- Pasta de dados resolvida na ordem: `CONTEXTFLOW_DADOS` → padrão do SO → criada com
  permissão restrita.
- Teste de **persistência real**: escrever, fechar tudo, reabrir, conferir.
- Teste de **migração**: schema antigo → atual sem perda.
- Importação de base sanitizada: contrato definido nesta fatia; **execução só com arquivo
  sanitizado fornecido pelo usuário**, nunca a base pessoal.

## Fora do escopo da F2

Ingestão de vídeo (F3), fila (F4), virtualização da tabela (F5), configuração editável (F8).
Exportação, só se aprovada depois.

## Modelo de dados — primeira migração

Tabelas alinhadas ao modelo conceitual de `03-arquitetura-e-contratos.md`:

| Tabela | Campos principais | Regra |
|---|---|---|
| `videos` | `id` (PK), `youtube_id` (UNIQUE), título, canal, duração, url, miniatura, publicado_em, estado, timestamps | identidade interna imutável; `youtube_id` garante deduplicação |
| `transcricoes` | `video_id` (FK), idioma, origem, estado, motivo | segmentos em tabela própria |
| `segmentos` | `transcricao_id` (FK), ordem, inicio_ms, fim_ms, texto | ordenação **por `ordem`**, nunca por texto |
| `resumos` | `video_id` (FK), provedor, modelo, versao_prompt, revisao_transcricao, texto, estado, erro | proveniência obrigatória |
| `colecoes` + `colecao_videos` | id, título / vínculo | N:N explícito |
| `_migracoes` | versao (PK), aplicada_em | controle do motor de migração |

**Regras duras:** `ON DELETE CASCADE` de vídeo para filhos; `revisao_transcricao` guarda o
hash/revisão que gerou o resumo (rastreabilidade); segredos **nunca** nesta base — vão para
armazenamento separado (F8).

## Índices

- `videos(criado_em DESC)` — ordenação padrão da Biblioteca.
- `videos(estado)`, `videos(canal_id)` — filtros.
- `videos(youtube_id)` — deduplicação (já UNIQUE).
- `segmentos(transcricao_id, ordem)` — leitura sequencial.

Busca textual por `LIKE` nesta fatia (1,45 ms→0,28 ms medidos com 10k). FTS real é
otimização de F5, com volume medido — não antecipar.

## Matriz de aceite da F2

| # | Cenário | Ação | Resultado observável | Evidência |
|---|---|---|---|---|
| B1 | Persistência real | inserir 3 vídeos via repositório, fechar o banco, reabrir | os 3 voltam com mesmo id | teste de integração com arquivo real |
| B2 | Deduplicação | inserir mesmo `youtube_id` duas vezes | erro de domínio, 1 registro | teste de unidade |
| B3 | Migração do zero | banco vazio → abrir | schema na versão atual, `_migracoes` registrada | teste |
| B4 | Migração idempotente | abrir duas vezes | segunda abre sem reaplicar | teste |
| B5 | Migração com dados | banco na v1 com dados → migrar para v2 | dados preservados, versão atualizada | teste |
| B6 | Rollback documentado | cada migração tem script de reversão descrito | reversão existe e é testada no caminho simples | teste |
| B7 | Cursor paginado | 250 vídeos, percorrer páginas | cada id aparece exatamente 1× | teste |
| B8 | Segredo fora do banco | inspecionar arquivo `.db` | nenhuma chave/token presente | teste de varredura |
| B9 | Pasta de dados | `CONTEXTFLOW_DADOS` apontando para temp | banco criado lá, nada em `platform/` | teste |
| B10 | Corrupção/erro de abertura | arquivo inválido no lugar do banco | erro claro, app não corrompe dados | teste |
| B11 | Persistência após reinício do app | subir app, inserir, matar processo, subir de novo | dados presentes via API | teste de integração HTTP |

## Compatibilidade e migração

- Migrações são append-only: nunca editar uma já aplicada, sempre adicionar.
- Cada migração tem `aplicar()` e `reverter()`; `reverter` é usado em teste.
- Base do original (Python/SQLite) **não é aberta** nesta fatia. O importador roda apenas
  sobre arquivo sanitizado, com `--dry-run` e relatório de divergências.

## Riscos

| Risco | Mitigação |
|---|---|
| `better-sqlite3` quebrar em Node futuro (ABI) | prebuilds acompanham o Node; versão fixada no `package-lock.json` |
| Migração mal escrita perder dado | toda migração com transação + teste de reversão + backup antes de migrar em produção |
| WAL deixar arquivos `-wal`/`-shm` no repo | `.gitignore` já cobre `*.db*`; pasta de dados fora do projeto |
| Volume grande degradar `LIKE` | medido 10k; se F5 mostrar problema, FTS com evidência |
