# PHASE 6 CONTRACTS (CONTRATOS)

**1. PubSub Eventos:**
- `REQUEST_SUMMARY(video_id)`: Disparado pela UI para enfileirar processamento de IA.
- `SUMMARY_READY(video_id, summary_data)`: Notifica que o resumo está pronto para exibição.
- `PREFS_CHANGED(config_dict)`: Notifica mudança em configurações de custo ou rede.

**2. AIService:**
- Interface única para chamadas de API, obrigando a verificação de `AICache` e `AIGovernance` antes da execução.


# Contratos de Comunicação: Fase 6

## 1. Eventos PubSub (Fluxo de Dados)

O sistema utiliza PubSub para manter o desacoplamento entre o processamento em background e a interface reativa.

### 1.1. Seleção e Visualização
*   **Evento:** `GRID_ITEM_SELECTED`
    *   **Payload:** `{video_id: str, has_summary: bool}`
    *   **Emissor:** `AnalysisPanel` (Aba 2) via Clique Simples na Grid.
    *   **Receptor:** `DetailPanel` (Base da Aba 2) + Lógica de Smart Show.
*   **Evento:** `SUMMARY_READY`
    *   **Payload:** `{video_id: str, summary_text: str}`
    *   **Emissor:** `Processor`.
    *   **Receptor:** `AnalysisPanel` (Atualiza célula na Grid e abre painel se selecionado).

### 1.2. Configurações
*   **Evento:** `SETTINGS_CHANGED`
    *   **Payload:** `{key: str, value: Any}`
    *   **Emissor:** `SettingsDialog`.
    *   **Receptor:** `ConfigManager` + componentes afetados (ex: `Processor` para troca de modelo).

## 2. Estrutura de Dados de Configuração (`user_settings.json`)

```json
{
    "ai_provider": "openai",
    "api_key": "sk-...",
    "model_name": "gpt-4o-mini",
    "ux_splitter_mode": "adaptive",
    "ux_sash_position": 400,
    "financial_limit": 5.0,
    "current_session_cost": 0.0
}
```

## 3. Garantias de Performance
*   **Non-Blocking UI:** Nenhuma operação de I/O de rede ou processamento de IA deve ocorrer na Thread Principal.
*   **Virtualization Invariant:** O `AppState` não deve instanciar objetos de transcrição completos para a Grid; apenas metadados e status. O texto completo é carregado *on-demand* pelo `DetailPanel`.
