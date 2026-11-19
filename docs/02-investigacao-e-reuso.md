# Investigação delimitada — E0

**Status: E0 PARCIALMENTE CONCLUÍDA.** Base inspecionada: projeto original em
`/home/user/contextflow` (leitura estática de código e documentos, nesta sessão).
**Não houve** execução do app original, nem auditoria completa de licenças,
dependências, segurança ou compatibilidade. Nada aqui é "homologado".

## ContextFlow original — fatos observados

- **Python desktop wxPython**: `main.py` instancia `wx.App` e `ui/app_window.py`;
  `requirements.txt` inclui `wxPython`, `yt_dlp`, `youtube-transcript-api`, `tiktoken`,
  `requests`.
- **Arquitetura existente**: `core/app_state.py`; `core/managers/{video,task,finance,theme}_manager.py`;
  `core/processor.py` com fila, `ThreadPoolExecutor`, cancelamento; `core/pubsub.py`;
  `storage/db_handler.py` usa SQLite com tabelas `videos`, `transcripts`, `ai_usage_log`,
  `ai_cache`, `system_config`.
- **YouTube**: `services/youtube_manager.py` usa yt-dlp, `youtube_transcript_api` e
  fallback de legendas. A presença do código **não prova** funcionamento com as mudanças
  atuais da API do YouTube.
- **IA**: `services/ai_executor.py`, `services/ai_providers/{google,ollama}_provider.py`,
  governança de tokens/custos.
- **UI existente**: `ui/tab_batch.py`, `ui/tab_analysis.py`, `ui/virtual_table.py`,
  `ui/panel_detail.py`, `ui/dialog_config.py`.
- **Documento histórico**: `docs/CURRENT_STATE.md` (datado 2026-04-09) descreve pipeline
  e contratos históricos; **pode estar defasado**.
- **Documentos antigos**: `.ai-context`, `docs/DECISION_LOG.md`, `docs/blueprint/PRD.md`,
  históricos — orientam migração, **não são requisitos novos**. Há inconsistência
  histórica de metas (5.000 vs 10.000 vídeos), a resolver por medição, não por cópia.

## Privacidade — regra dura

O projeto original contém `config/credentials.json`, bancos SQLite, thumbs e `.git/`.
Esses materiais **nunca** são copiados para `contextflow2` nem para
`Continuidade de Projeto/`, nem entram em commit. O original permanece **somente leitura**.

## Referências externas — evidências documentais, NÃO código auditado

- **YouTube Learning Tracker** (github.com/Samuel-025/youtube-learning-tracker): README
  descreve app/CLI Python + Streamlit local-first, biblioteca, coleções, metadados/
  transcrição, resumos, busca, Q&A, exportações. Candidato a referência de **UX e fluxo**;
  validar licença e testar antes de copiar qualquer código.
- **OpenScribe Studio** (github.com/michaelxer/openscribe-studio): desktop Python com
  faster-whisper, yt-dlp, FFmpeg; exports SRT/VTT/TXT/Markdown/JSON; MIT declarada.
  Candidato a referência de **fluxo de tarefas/exportação**, **não** dependência central.
- **Agent Window**: inspiração modular futura para contexto/memória de chat.
  **Não inspecionado**; nenhuma alegação de reuso implementável.

## Hipóteses de reuso

1. **Reuso conceitual / migração de regras** do original: deduplicação, UUIDs,
   fila/retomada, estimativa de custos, parsing de transcrições, exportação, estados da
   UI. Contratos **devem ser reespecificados** para Node/TS.
2. **Reuso direto de código Python**: exige análise de licença, integração e custo
   operacional. **Não presumir** que vale a pena.
3. **yt-dlp** é ferramenta externa invocável por Node via subprocesso seguro; validar
   disponibilidade e comportamento em Windows/Linux; **nunca** interpolar URLs em shell
   sem escape — `spawn` com array de argumentos, `shell: false`.

## Achados desta sessão (complementam o pacote)

| Achado | Evidência | Impacto |
|---|---|---|
| Diretório `G:\.Projetos`, caminho absoluto no original, aparece nas fontes | `-atualiza-git.bat`, `core/proxy_manager.py` | Na migração, **nenhum path absoluto**; usar pasta de dados configurável (`%APPDATA%`/`~/.local/share`) |
| `.gitignore` do original exclui `data/`, `*.db`, `thumbs/`, `exports/` | `/home/user/contextflow/.gitignore` | Mesma política no novo projeto: dados de runtime fora do Git |
| Metas históricas divergentes (5k vs 10k) | `docs/history/*` do original | Não herdamos meta numérica; medir na F5 e registrar |
| Stack original era desktop; V1 é web local | `main.py` (wx.App) | Migração de **regras**, não de UI |

## E0 — o que resta (não é bloqueio para F1)

1. Medir extração real de legendas (manual e automática) com yt-dlp em vídeos
   disponíveis/indisponíveis — **fazer na F3 com teste real**.
2. Definir banco/ORM com evidência — **fazer na SPEC de F2**.
3. Verificar disponibilidade de yt-dlp em Windows e Linux e o modo de distribuição —
   **fazer na F1/F9**, com limitação declarada se não testável.
4. Auditar licença do Learning Tracker antes de qualquer reuso — **somente se houver
   intenção de reuso direto**, o que não é o plano atual (reuso é conceitual).

**Critério de parada de E0:** mapa ponta a ponta, riscos e escolhas de reuso mapeados.
Atingido: os fluxos estão descritos em `03-arquitetura-e-contratos.md` e as pendências de
banco/legendas têm fatia e momento definidos. Investigação adicional ocorre **dentro** da
fatia que precisa dela, não como pesquisa aberta.
