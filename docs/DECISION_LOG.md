# DECISION_LOG — ContextFlow

## Formato
`[FASE] | [TIPO] | [DECISÃO] | [MOTIVO] | [ARQUIVOS IMPACTADOS]`

Tipos: ADD, MOD, DEL, FREEZE, RULE, CFG

---

### Fase 1 a 5.5 — Estabilização do Core
F1 | ADD | UUID para tarefas | Rastreamento antes de ID real | `processor.py`
F2 | MOD | Row Mapping por UUID | Sincronia entre fila e grid | `ui/virtual_table.py`
F5.5| ADD | GridTableBase Virtual | Suporte a 10.000+ vídeos | `ui/virtual_table.py`

### Fase 5.6 a 5.9 — Blindagem e Layout
F5.6| RULE | Estimativa de Tokens Prévia | Previsibilidade econômica | `ai_governance.py`
F5.7| MOD | Separação física de Abas | Eliminar instabilidade da God Class | `ui/tab_batch.py`, `ui/tab_analysis.py`
F5.8| ADD | Ações em Massa (MD/ZIP) | Autonomia na exportação técnica | `ui/tab_batch.py`
F5.9| ADD | Layout Master-Detail | Análise visual e técnica simultânea | `ui/tab_analysis.py`

### Fase 5.10 a 5.12 — Governança e Controle
F5.10| CFG | `credentials.json` | Persistência simples de chaves API | `core/config_manager.py`
F5.11| RULE | Sincronia via PubSub | Cross-tab refresh atômico | `ui/app_window.py`
F5.12| ADD | Painel de Controle Operacional| Governança total via UI | `ui/dialog_config.py`

### Fase 6.0 — Industrialização
F6.0| MOD | Fragmentação do AppState | `app_state.py` era uma God Class | `core/managers/*`
F6.0| ADD | Gerentes Especializados | Escalonabilidade de manutenção | `core/managers/`
F6.0| RULE | Kill-Switch Atômico | Controle total sobre threads | `core/managers/task_manager.py`

### Otimização da Documentação
- | DEL | Documentação Obsoleta | Reduzir ruído e consumo de tokens | `docs/blueprint/`, `docs/tracking/`
- | MOD | Arquivamento Progressivo | Renomear histórico para `.resolved` | `docs/history/PHASE_5.*`
- | ADD | Instruções SSoT (.ai-context) | Blindar IA contra histórico antigo | `.ai-context`, `.humano`

### Fase 6.1a — Infraestrutura de IA
F6.1a| ADD | Provider Ollama (HTTP direto) | Validado em teste: 27K tokens, 4.86s | `services/ai_providers/ollama_provider.py`
F6.1a| ADD | Discovery automático via HTTP | /api/tags + /api/show em vez de subprocess | `services/ai_discovery.py`
F6.1a| ADD | AIExecutor com Map-Reduce | Encapsulado: UI só vê summarizing→summarized | `services/ai_executor.py`
F6.1a| ADD | Migração DB (tags, summary_status) | JSON string + 4 estados de status | `storage/db_handler.py`
F6.1a| ADD | PubSub Events de IA | SUMMARY_STARTED, COMPLETED, ERROR | `services/ai_executor.py`
F6.1a| RULE | HTTP Direto Obrigatório | Sem subprocess, sem biblioteca ollama | `services/ai_providers/`
F6.1a| RULE | Zero UI na Fase 6.1a | Separação total infra/view | Todos os novos arquivos

### Fase 6.1b — Integração UI de IA
F6.1b| ADD | Seletor IA na Toolbar Aba 2 | Provedor + Modelo dinâmico via Discovery HTTP | `ui/tab_analysis.py`
F6.1b| ADD | Batch Summarize funcional | Seleção + confirmação + enfileiramento no TaskManager | `ui/tab_analysis.py`
F6.1b| ADD | Menu contexto "Resumir" | Ativado em Aba 1 e Aba 2 (antes era placeholder) | `ui/tab_analysis.py`, `ui/tab_batch.py`
F6.1b| MOD | Viewer condicional | Painel só abre com resumo. Config auto_open_viewer | `ui/tab_analysis.py`, `ui/app_window.py`
F6.1b| MOD | ChipTagRenderer com dados reais | Parse de JSON string do campo videos.tags | `ui/virtual_table.py`
F6.1b| MOD | Coluna Resumo dinâmica | 4 estados visuais baseados em summary_status | `ui/virtual_table.py`
F6.1b| RULE | Import Barrier reforçada | UI não importa services/ai_*. Tudo via AppState | Todos os arquivos UI
F6.1b| RULE | wx.CallAfter obrigatório | Todo PubSub handler que toca UI | `ui/tab_analysis.py`, `ui/app_window.py`

### Fase 6.2 — UI Polish e Organização
F6.2 | MOD | `DialogConfig` Saneado | Tamanho 980x720, IA tab simplificada (Gemini/Ollama) | `ui/dialog_config.py`
F6.2 | ADD | `TagWrapPanel` | Visualização moderna de tags com wrap | `ui/components/tag_wrap_panel.py`
F6.2 | ADD | `SummaryStatusRenderer` | Feedback visual semântico na Grid (Summarizing, Error, CTA) | `ui/virtual_table.py`
F6.2 | MOD | `ThemeManager` Multi-Theme | Suporte a Light e SaaS Dark via PubSub | `core/managers/theme_manager.py`
F6.2 | ADD | Persistência de Layout | Column Widths e Theme salvos via `ConfigManager` | `ui/tab_analysis.py`, `ui/tab_batch.py`
F6.2 | RULE | CSS Dinâmico no Viewer | WebView injeta cores do `ThemeManager` via JS/CSS | `ui/panel_detail.py`
F6.2 | RULE | HeidiSQL density | Light Mode/SaaS Dark mantêm alta densidade técnica | Global
F6.2 | BUGFIX | Correção do Dark Mode | Adaptação robusta via `theme.get_grid_bg()` e `ConsolePanel` | `ui/virtual_table.py`, `ui/panel_console.py`
F6.2 | BUGFIX | Coluna Resumo Interativa | Disparo do resume via clique na célula sem texto extenso | `ui/tab_analysis.py`, `ui/virtual_table.py`

### Fase 6.2c — Estabilização Final do Sistema de Temas
F6.2c | BUGFIX | Propagação Notebook/Splitters | Notebook e Splitters não recebiam cor no toggle | `ui/app_window.py`
F6.2c | BUGFIX | StaticText FG na Sidebar | Label "Histórico" ilegível no dark | `ui/sidebar.py`
F6.2c | BUGFIX | StaticText FG no TabBatch | Labels de seção ilegíveis no dark | `ui/tab_batch.py`
F6.2c | MOD | Simplificação apply_theme TabAnalysis | getattr em vez de __class__.__name__ | `ui/tab_analysis.py`
F6.2c | RULE | Limitações wxWidgets documentadas | StaticBox e Notebook tabs não propagam FG no Windows | docs/
F6.2c | MOD | GenButton para btn_reset_safety | Botão nativo ignora SetBackgroundColour no Windows | `ui/tab_batch.py`
F6.2c | ADD | ThemeManager.apply_to_button() | Utilitário para aplicar tema a botões genéricos | `core/managers/theme_manager.py`
F6.2c | ADD | DialogConfig._apply_internal_theme() | Propagação forçada para ScrolledWindow internos | `ui/dialog_config.py`
F6.2c | MOD | ThemeDebugger whitelist | Falsos positivos em botões com cores intencionais | `scripts/debug_theme.py`

### Fase 6.2d — Correções Finais de Contraste e Inicialização do Dark Mode
F6.2d | BUGFIX | Inicialização dark mode | apply_theme chamado no __init__ quando theme=dark | `ui/app_window.py`
F6.2d | BUGFIX | Botão ☰ invisível | FG hardcoded preto → tema dinâmico | `ui/sidebar.py`
F6.2d | BUGFIX | Cores hardcoded em _init_ui | wx.Colour(230,230,230) → theme.get_highlight_color() | `ui/tab_batch.py`, `ui/tab_analysis.py`
F6.2d | BUGFIX | WebView flash branco | background-color:white → bg_hex do tema | `ui/panel_detail.py`
F6.2d | BUGFIX | Labels pretos na toolbar | FG não aplicado na construção | `ui/components/analysis_toolbar.py`
F6.2d | BUGFIX | Contraste StaticBox | SetForegroundColour(fg) forçado para títulos de seção | `ui/dialog_config.py`, `ui/tab_batch.py`

### Fase 7.2 — Falhas Técnicas Imediatas
F7.2 | BUGFIX | COALESCE Invertido | Prioriza `excluded.status` para permitir persistência de 'completed' | `storage/db_handler.py`
F7.2 | BUGFIX | Filtro de Resunção | Exclui explicitamente 'completed' do pool de retomada no boot | `core/processor.py`
F7.2 | MOD | Persistência Síncrona | UPDATE no DB antes da notificação de UI em `_process_task` | `core/processor.py`
F7.2 | ADD | PubSub AI Visibility | TabBatch monitora SUMMARY_COMPLETED/ERROR para fechar gauge | `ui/tab_batch.py`
F7.2 | ADD | Handlers Globais de IA | Feedbacks em StatusBar e Log para eventos de resumo | `ui/app_window.py`
F7.2 | RULE | Invariante Nº2 Reforçada | Persistência física OBRIGATÓRIA antes de qualquer cache de memória | Global
