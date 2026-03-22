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
