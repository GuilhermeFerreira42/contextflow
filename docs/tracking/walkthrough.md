# Implementation Plan - Phase 5.7 SSoT Consolidation

Document set sanitization to establish Phase 5.7 as the absolute Source of Truth, eliminating all "future noise" and legacy ambiguities.

## Proposed Changes

### 1. Blueprint Sanitization
- **PRD.md:** Remove all mentions of IA, Tags, Summaries, and Phase 6 requirements.
- **ROADMAP.md:** Remove Phase 6 and 7. Set status to "5.7 Consolidation".
- **DB_SCHEMA.md:** Delete future tables (`video_tags`, `summaries`).

### 2. History & Protocol Reinforcement
- **PHASE_5_7_SPECS.md:** Mandate `wx.Timer` with restart logic for 250ms debouncing.
- **PHASE_5_7_EXECUTION.md:** Add `no-circular-imports` audit to validation steps. Explicitly confirm `ui/panel_grid.py` as INTERDICTED.

## Verification Plan

### Manual Verification
- Confirm that no "IA", "Tag" or "Summary" keywords remain in blueprints.
- Confirm tree structure contains only underline patterns for Phase 5.7.
- Verify dependency graph in `ARCHITECTURE.md`.
- **Invariante de Prompt**: Se o prompt for alterado, o cache é invalidado automaticamente para garantir consistência.

## 🛡️ O Painel (Instrumentação e Telemetria) - Passo 2

Concluímos a instrumentação total da pipeline de processamento. O sistema agora é capaz de auditar sua própria performance em tempo real.

### 1. Rastreamento Granular
Implementamos o [TimeTracker](file:///c:/Users/Usuario/Desktop/contextflow/core/metrics.py#5-24) e [MetricsCollector](file:///c:/Users/Usuario/Desktop/contextflow/core/metrics.py#25-49) em [core/metrics.py](file:///c:/Users/Usuario/Desktop/contextflow/core/metrics.py), capturando:
- **`queue_wait_ms`**: Tempo exato que o vídeo esperou na fila antes de ser processado.
- **`fetch_ms`**: Duração da extração de metadados e transcrição (Gargalo de rede).
- **`llm_processing_ms`**: Tempo de resposta da IA (Gargalo de API).
- **`ui_render_ms`**: Overhead total do sistema.
- **`total_tti_ms`**: Time To Insight total.

### 2. Instrumentação do Processor
O [core/processor.py](file:///c:/Users/Usuario/Desktop/contextflow/core/processor.py) foi modificado para disparar o rastreamento em cada fase crítica, persistindo os resultados na tabela `ai_usage_log`.

## 🛡️ O Escudo (Blindagem da Extração) - Passo 3

Implementamos um sistema de defesa de rede para garantir que o ContextFlow sobreviva a bans de IP e restrições geográficas.

### 1. Rotação e Gestão de Proxies
- **[ProxyManager](file:///c:/Users/Usuario/Desktop/contextflow/core/proxy_manager.py#11-62)**: Carrega e rotaciona proxies de `config/proxies.txt`.
-# Task: Consolidate Phase 5.7 SSoT (Fonte Única de Verdade)

- [/] Phase 1: Blueprint Sanitization (Purge Future Noise)
    - [ ] Purge `docs/blueprint/PRD.md` (Remove IA/Tags/Resumos)
    - [ ] Purge `docs/blueprint/ROADMAP.md` (Remove Phase 6+)
    - [ ] Purge `docs/blueprint/DB_SCHEMA.md` (Remove future tables)
- [/] Phase 2: History Consolidation
    - [x] Delete dot-pattern files in `docs/history/PHASE_5.7/`
    - [ ] Update `PHASE_5_7_SPECS.md` (wx.Timer Debounce Upgrade)
    - [ ] Update `PHASE_5_7_EXECUTION.md` (Add no-circular-imports audit)
- [/] Phase 3: Final Verification
    - [ ] Verify `ui/panel_grid.py` interdiction status in all docs
    - [ ] Generate sanitized tree view
    - [ ] Present new ARCHITECTURE.md dependency graph
- [ ] Notify Auditor (User)
para paralisar o sistema em caso de ataques ou bloqueios massivos.

### 1. Cooldown Global Alpha
- **[CooldownManager](file:///c:/Users/Usuario/Desktop/contextflow/core/cooldown_manager.py#9-53)**: Quando um erro 429 é detectado em nível sistêmico, o ContextFlow entra em "Estado de Hibernação" por 1 hora.
- **Persistência em SQLite**: O estado de cooldown é salvo na nova tabela `system_config`. Se o usuário fechar e abrir o app, o sistema ainda lembrará que está em proteção.

## 🧪 Provas de Verificação - Passos 3 e 4

### Verificação do Escudo (Rotação e Aborto)
Validamos que o sistema rotaciona proxies e aborta por segurança se a infra estiver ausente.

```text
INFO:contextflow.proxy:Loaded 2 proxies.
Rotated: http://proxy2:8080, http://proxy1:8080
WARNING:contextflow.proxy:Proxy http://proxy1:8080 banned due to 429.
...
ERROR:contextflow.processor:ALERTA DE SEGURANÇA: Fila > 20 sem Proxies. Abortando.
```

### Verificação do Freio (Persistência)
Validamos que o Cooldown sobrevive a um restart do sistema.

```text
Step 1: Triggering 5-minute cooldown...
GLOBAL COOLDOWN TRIGGERED! Suspended until 12:01:10
...
Step 2: Simulating app restart...
Persisted - Is cooling: True, Remaining: 300s
SUCCESS: Cooldown persisted in SQLite.
```

---
**Fim da Implementação Técnica.** Próxima etapa: **Homologação (Stress Test)**.

## 📂 Arquivos Modificados
- [db_handler.py](file:///c:/Users/Usuario/Desktop/contextflow/storage/db_handler.py): Suporte a logs e cache.
- [ai_prices.json](file:///c:/Users/Usuario/Desktop/contextflow/config/ai_prices.json): [NEW] Configuração de preçário.
- [ai_governance.py](file:///c:/Users/Usuario/Desktop/contextflow/core/ai_governance.py): [NEW] Motor de governança.

---
**Próximo Passo:** Instrumentação de Telemetria (O Painel).
