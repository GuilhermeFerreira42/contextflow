# 5️⃣ PHASE\_6\_TRACEABILITY\_MATRIX.md

## 1\. Matriz de Rastreabilidade Operacional

Esta tabela define o contrato de aceite binário (Passa/Falha) para a conclusão da Fase 6.

| RF | Requisito Funcional | Componente | Ficheiro Alvo | Método/Classe | Teste de Validação | Critério de Aceite |
| --- | --- | --- | --- | --- | --- | --- |
| RF-01 | Discovery Ollama | AIDiscovery | services/ai_discovery.py | get_ollama_models | test_ollama_list | Retorna lista de strings com nomes de modelos locais. |
| RF-02 | Discovery Google | AIDiscovery | services/ai_discovery.py | get_google_models | test_google_list | Retorna lista de modelos com API Key válida. |
| RF-03 | Persistência AI | AIManager | core/state/ai_manager.py | set_selected_model | test_config_persistence | Escolha gravada no config.json e mantida após restart. |
| RF-04 | Token Multi-Model | TokenEngine | core/token_engine.py | count_by_family | test_token_accuracy | Erro < 1% comparado ao tokenizer nativo. |
| RF-05 | Sumarização Isolada | AIExecutor | services/ai_executor.py | execute_summary | test_context_sandbox | Prompt de sistema limpo em cada nova chamada. |
| RF-06 | Escrita Atómica | TaskWorker | core/state/task_worker.py | _on_task_complete | test_atomic_write | Resumo gravado no DB antes de emitir PubSub. |
| RF-07 | Auto-Tagging | AIExecutor | services/ai_executor.py | parse_ai_response | test_tag_extraction | Tags extraídas do JSON da IA e gravadas na tabela video_tags. |
| RF-08 | Slots de Execução | TaskWorker | core/state/task_worker.py | _acquire_slot | test_concurrency_slots | Ollama nunca processa mais de 1 vídeo por vez. |
| RF-09 | Pop-up Check-out | UI/Dialogs | ui/dialog_checkout.py | ShowModal | test_checkout_math | Soma de tokens exibida = soma dos vídeos selecionados. |
| RF-10 | UI Locking | AIManager | core/state/ai_manager.py | is_provider_locked | test_ui_lock_state | Botão/Dropdown desativado durante execução ativa. |
| RF-11 | Fila Persistente | TaskWorker | core/state/task_worker.py | resume_pending | test_crash_recovery | Tasks IDLE no DB são retomadas após restart do app. |
| RF-12 | Refat. AppState | StateManager | core/state/state_manager.py | Facade Pattern | test_legacy_compat | Funções da Fase 5 continuam operantes via Facade. |
| RF-13 | Display Resumo | UI/Panels | ui/panel_detail.py | update_insights | test_ui_render | Blocos ID/Tópico/Análise renderizados corretamente. |
| RF-14 | Error Logging | AIExecutor | services/ai_executor.py | handle_api_error | test_error_logs | Erro 429 ou Offline gera log ERROR sem vazar API Key. |

## 2\. Gap Report (Análise de Lacunas)

-   **Status:** VAZIO.
    
-   **Observação:** Todos os requisitos funcionais mapeados na `PHASE_6_TECH_SPECS.md` possuem cobertura nesta matriz. Nenhuma funcionalidade está "órfã" de componente ou teste.
    

## 3\. Critérios de Aceite Binário (Definition of Done)

A sub-fase só será considerada concluída se:

1.  **Código:** 100% dos métodos listados na coluna "Método/Classe" estiverem implementados.
    
2.  **Testes:** Todos os testes de validação listados passarem em ambiente local (Ollama) e Cloud (Google Test Key).
    
3.  **Arquitetura:** O ficheiro `app_state.py` não contiver lógica de IA (apenas delegação).
    
4.  **Estabilidade:** O app não apresentar `Not Responding` durante o processamento de um vídeo de 100k tokens.
    

* * *

> **Validação de Rastreabilidade:** Este documento assegura que o desenvolvimento não se desviará para funcionalidades não solicitadas e que nenhuma promessa técnica ficará sem implementação verificável.

