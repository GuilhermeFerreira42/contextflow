# SPEC F6 — IA para resumos: provedores, configuração, custos, erros, seleção múltipla

**Status:** rascunho para revisão. Não implementada.

## Objetivo

Gerar resumos dos vídeos da biblioteca usando provedores de IA configuráveis (OpenAI, Anthropic, Ollama local, etc.), com controle de custos estimados, tratamento de erros, múltiplas seleções e rastreabilidade completa do que foi resumido. O usuário escolhe provedor, modelo e prompt; o sistema processa em lote pela fila F4 e persiste o resultado vinculado à revisão exata da transcrição usada.

Escopo canônico (01-escopo-canonico.md): *provedores e modelos configuráveis; processar texto sob solicitação ou lote, indicar custos estimados quando possível e limites/erros; preservar texto-fonte e metadados; não sobrescrever silenciosamente dados existentes.*

## Base inspecionada e reuso

- **F2**: tabela `resumos` já existe com `video_id`, `provedor`, `modelo`, `versao_prompt`, `revisao_transcricao`, `texto`, `estado`, `erro`, timestamps, PK composta.
- **F3**: transcrições normalizadas com segmentos, estado `pronto`/`indisponivel`, `codigoMotivo` para distinguir ausência definitiva de falha recuperável.
- **F4**: fila `FilaTrabalhos` com `TipoTrabalho = 'gerar-resumo'`, concorrência limitada, retry idempotente, cancelamento cooperativo, progresso observável.
- **F5**: Biblioteca com seleção múltipla, ação em lote `reimportar` (já usa fila), `colecaoIds`, `temResumo` denormalizado.
- **Contratos**: `Resumo` em `@contextflow/compartilhado` já define estrutura; `EstadoResumo = 'pendente' | 'processando' | 'pronto' | 'erro'`.

## Decisões técnicas propostas (para revisão)

| Decisão | Valor proposto | Motivo |
|---|---|---|
| Provedores suportados | **OpenAI** (chat/completions), **Anthropic** (messages), **Ollama** (local, `/api/chat`), **OpenAI-compatível** (base URL custom) | cobre cloud, local e compatíveis; extensível por registro |
| Autenticação | Chaves/tokens **nunca no banco principal**; arquivo separado `secrets.json` com permissão 0600, carregado só no processo do motor | decisão F8 antecipada; segredos isolados do backup/migração |
| Estimativa de custo | `input_tokens * preco_input + output_tokens_estimados * preco_output` por modelo; tabela de preços embutida + override por config; exibida **antes** de enfileirar | usuário decide se vale a pena; não executa sem consentimento |
| Prompt | Versão semântica (`v1`, `v2`, `v1.1`); template com placeholders `{transcricao}`, `{titulo}`, `{canal}`, `{duracao}`; validação de tamanho (max tokens) | rastreabilidade: `versao_prompt` na PK garante que mudança de prompt = novo resumo |
| Concorrência de IA | Respeita `CONTEXTFLOW_CONCORRENCIA` (default 2); cada provedor pode ter `maxConcurrency` próprio (ex.: Ollama local = 1) | evita rate limit 429 e OOM local |
| Truncamento de entrada | Se transcrição > `max_input_tokens`, resumir em **map-reduce**: pedaços → resumos parciais → resumo final | textos longos (TED 20min = ~15k tokens) não cabem em contexto único |
| Idempotência | `chaveRequisicao` = `resumo-${videoId}-${provedor}-${modelo}-${versaoPrompt}`; retry não duplica | mesma regra F4 |
| Cancelamento | Propaga `AbortSignal` para HTTP do provedor; em streaming, fecha conexão; marca `cancelado` na fila | consistente com F4 |
| Erros recuperáveis vs definitivos | 429/5xx/timeout = `falhou` (retry automático via F4); 401/403/invalid_key = `erro` (precisa intervenção); transcrição indisponível = não enfileira | `codigoMotivo` da F3 já distingue |

## Contratos

### HTTP (novos endpoints)

| Rota | Entrada | Saída |
|---|---|---|
| `GET /api/resumos/provedores` | — | `{provedores: [{id, nome, modelos: [{id, nome, maxTokens, precoInput1k, precoOutput1k, suportaStreaming}]}, ...]}` |
| `GET /api/resumos/configuracao` | — | configuração atual (provedor, modelo, prompt, baseUrl) — **sem segredos** |
| `POST /api/resumos/configuracao` | `{provedor, modelo, versaoPrompt, prompt?, baseUrl?, maxConcurrency?}` | valida e persiste; testa conexão se `testar: true` |
| `POST /api/resumos/estimar` | `{videoIds: string[], provedor?, modelo?}` | `{estimativas: [{videoId, tokensEntrada, custoEstimado, avisos}], totalTokens, custoTotal}` |
| `POST /api/resumos/gerar` | `{videoIds: string[], provedor?, modelo?, versaoPrompt?, chaveRequisicao?}` | enfileira `gerar-resumo` para cada; retorna `{trabalhos: [{id, videoId}]}` |
| `GET /api/resumos/:videoId` | — | lista de resumos do vídeo (histórico por provedor/modelo/prompt) |
| `GET /api/biblioteca/:id/resumo` | — | resumo mais recente `pronto` ou `null` |

> `POST /api/trabalhos` (F4) já aceita `tipo: 'gerar-resumo'` com escopo `{videoId, provedor, modelo, versaoPrompt, chaveRequisicao}`.

### Configuração (persistida em `config.json` na pasta de dados)

```json
{
  "resumos": {
    "provedor": "openai",
    "modelo": "gpt-4o-mini",
    "versaoPrompt": "v1",
    "prompt": "Resuma o vídeo em português, em até 3 parágrafos, destacando pontos principais. Transcrição: {transcricao}",
    "baseUrl": "https://api.openai.com/v1",
    "maxConcurrency": 2
  }
}
```

Segredos (`apiKey`) vão em `secrets.json` (mesma pasta, 0600):
```json
{ "openai": { "apiKey": "sk-..." }, "anthropic": { "apiKey": "sk-ant-..." } }
```

### Compartilhado (já existe, sem mudanças)

```ts
export interface Resumo {
  videoId: IdVideo;
  provedor: string;
  modelo: string;
  versaoPrompt: string;
  revisaoTranscricao: string;  // hash da transcrição usada
  texto: string | null;
  estado: EstadoResumo;
  erro: string | null;
  criadoEm: string;
  atualizadoEm: string;
}
export type EstadoResumo = 'pendente' | 'processando' | 'pronto' | 'erro';
```

### UI (comportamento observável)

- **Tela Resumos** (nova aba ou integrada na Biblioteca): lista vídeos com `temResumo` badge; botão "Gerar resumo" abre modal com:
  - Seleção de provedor/modelo (carregado de `/api/resumos/provedores`)
  - Editor de prompt com placeholders e preview de tokens
  - Estimativa de custo total antes de confirmar
  - Checkbox "Processar em lote" (usa fila F4, mostra progresso na aba Importações)
- **Na Biblioteca**: coluna "Resumo" com badge `pronto`/`processando`/`erro`/vazio; clique abre painel lateral com texto completo, cópia, regenerar (nova versão de prompt)
- **Na Leitura**: seção "Resumo" acima da transcrição, colapsável
- **Progresso**: polling em `/api/trabalhos?tipo=gerar-resumo` mostra fase `enviando`, `processando`, `finalizando`
- **Erros**: toast com `erro.codigo` estável (`rate_limit`, `auth_invalido`, `transcricao_indisponivel`, `contexto_excedido`); botão "Tentar de novo" reenfileira com mesma chave

## Persistência e migração

**Migração 004** (append-only, transação, reversível):

```sql
-- Campos novos em resumos (já existem na F2, apenas garantindo)
-- Nenhuma mudança de schema necessária se F2 já criou a tabela completa.
-- Se F2 não criou, esta migração cria:
CREATE TABLE IF NOT EXISTS resumos (
  video_id TEXT NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  provedor TEXT NOT NULL,
  modelo TEXT NOT NULL,
  versao_prompt TEXT NOT NULL,
  revisao_transcricao TEXT NOT NULL,
  texto TEXT,
  estado TEXT NOT NULL CHECK (estado IN ('pendente','processando','pronto','erro')),
  erro TEXT,
  criado_em TEXT NOT NULL,
  atualizado_em TEXT NOT NULL,
  PRIMARY KEY (video_id, provedor, modelo, versao_prompt)
);

-- Arquivo de segredos não entra no banco; criado em runtime se não existir.
```

- `revisao_transcricao` = hash (SHA-256) dos segmentos concatenados + idioma + origem. Garante que se a transcrição mudar (reimportação), o resumo antigo fica preservado e novo é gerado com nova revisão.
- `tem_resumo` em `videos` (F5) atualizado para 1 quando `estado='pronto'`, 0 quando erro/removido.

## Matriz de aceite da F6

| # | Cenário | Ação | Resultado observável | Evidência |
|---|---|---|---|---|
| F6.1 | Configurar provedor OpenAI | `POST /api/resumos/configuracao` com apiKey válida | conexão testada, config persistida, `/api/resumos/configuracao` retorna sem segredo | integração |
| F6.2 | Estimar custo | selecionar 3 vídeos, pedir estimativa | tokens de entrada calculados, custo total exibido, avisos se > limite modelo | integração + E2E |
| F6.3 | Gerar resumo único | 1 vídeo, provedor configurado | trabalho enfileirado, fase `processando` → `pronto`, texto salvo, `tem_resumo=1` | integração + E2E |
| F6.4 | Gerar resumo em lote | selecionar 5, "Processar em lote" | 5 trabalhos enfileirados com chaves idempotentes; progresso por vídeo | integração + E2E |
| F6.4b | Lote com transcrição indisponível | vídeo `parcial` sem legenda no lote | trabalho não enfileirado para esse vídeo; aviso na UI; outros processam | integração |
| F6.5 | Cancelar geração | clicar "Cancelar" na Importações | `AbortSignal` propagado, HTTP fechado, trabalho `cancelado`, sem resumo parcial salvo | integração + E2E |
| F6.6 | Retry após 429 | provedor devolve 429 | trabalho `falhou` com `erroCodigo='rate_limit'`; retry automático via F4 (até 3x com backoff) | integração (dublê) |
| F6.7 | Erro de autenticação | apiKey inválida | trabalho `erro` com `erroCodigo='auth_invalido'`; **sem retry automático**; toast orienta corrigir chave | integração |
| F6.8 | Transcrição muito longa (map-reduce) | vídeo 40k tokens, modelo 16k | pedaços → parciais → final; texto coerente; tokens totais registrados | integração (dublê) |
| F6.9 | Mudança de prompt gera novo | mesmo vídeo, `versaoPrompt: 'v2'` | novo registro em `resumos` (PK diferente); antigo preservado; `tem_resumo` continua 1 | integração |
| F6.10 | Reimportação de vídeo | vídeo reimportado, transcrição muda | nova `revisaoTranscricao`; resumo antigo fica; novo geração usa revisão nova | integração |
| F6.11 | Ollama local | provedor `ollama`, modelo `llama3.1` | HTTP para `localhost:11434/api/chat`; sem apiKey; streaming opcional | integração (se disponível) |
| F6.12 | Segredos isolados | backup do banco (VACUUM INTO) | `secrets.json` **não** incluído no backup; permissões 0600 mantidas | teste de backup |
| F6.13 | UI - Biblioteca | badge "Resumo" em cada linha | `pronto`/`processando`/`erro`/vazio condiz com banco; clique abre painel | E2E |
| F6.14 | UI - Leitura | seção Resumo acima da transcrição | texto completo, cópia, botão regenerar | E2E |
| F6.15 | Regressões F3/F4/F5 | rodar suíte completa | 151+ testes passam; E2E 26/26; fumaça TUDO OK | `npm test && npm run test:e2e && npm run verificar` |

## Testes previstos

**Unidade**
- `resumos-provedores.test.ts`: registro de provedores, validação de modelo, estimativa de tokens (tiktoken aproximado), map-reduce splitting.
- `resumos-config.test.ts`: carregamento `config.json` + `secrets.json`, merge, validação, teste de conexão.
- `resumos-prompt.test.ts`: template placeholders, versão semântica, validação de tamanho.

**Integração**
- `resumos-api.test.ts`: endpoints configuracao, estimar, gerar, listar; chaves idempotentes; erros mapeados.
- `resumos-fila.test.ts`: trabalho `gerar-resumo` processado pela `FilaTrabalhos`; cancelamento; retry; concorrência.
- `resumos-mapreduce.test.ts`: transcrição longa simulada → pedaços → resultado final.

**E2E (CDP real)**
- Configurar OpenAI (mock server local), estimar 3 vídeos, gerar lote, acompanhar progresso na Importações.
- Cancelar no meio, verificar que não salvou parcial.
- Erro 401 → toast + botão corrigir → retry → sucesso.
- Mudar prompt → novo resumo, antigo acessível via `/api/resumos/:videoId`.

## Riscos e decisões pendentes

| Risco | Impacto | Mitigação |
|---|---|---|
| Rate limit 429 crônico | lentidão, custos | backoff exponencial + `maxConcurrency` por provedor; estimativa prévia evita surpresa |
| Custo real > estimado | usuário surpreendido | margem de segurança 20% na estimativa; log de tokens reais para calibrar |
| Transcrição muda sutilmente | resumo desatualizado silencioso | `revisaoTranscricao` hash garante detecção; UI avisa "transcrição atualizada desde o resumo" |
| Ollama não instalado | erro confuso | diagnóstico em `/api/resumos/provedores` mostra `disponivel: false` com orientação |
| Segredos em log | vazamento | `Registrador` já redige chaves; teste de varredura em logs |
| Provedor muda API | quebra silenciosa | versionamento de cliente por provedor; testes de contrato contra mocks |

## Definição de concluído

- Todas as matrizes F6.1–F6.15 com evidência executada (logs, screenshots, métricas de custo/tokens).
- Suíte completa verde (`npm test`, `npm run test:e2e`, `npm run verificar`).
- Pelo menos 2 provedores testados (ex.: OpenAI mock + Ollama local se disponível).
- Map-reduce validado com transcrição > limite de contexto.
- Segredos isolados, backup sem segredos, permissões 0600.
- `docs/estado-atual.md` atualizado com commit, métricas, próximo passo.
- Commit próprio da F6.

---

**Precedência:** `01-escopo-canonico.md` > `03-arquitetura-e-contratos.md` > esta SPEC > `04-plano-mestre.md`.