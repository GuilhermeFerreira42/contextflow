# PHASE 6 CONTRACTS (CONTRATOS)

**1. PubSub Eventos:**
- `REQUEST_SUMMARY(video_id)`: Disparado pela UI para enfileirar processamento de IA.
- `SUMMARY_READY(video_id, summary_data)`: Notifica que o resumo está pronto para exibição.
- `PREFS_CHANGED(config_dict)`: Notifica mudança em configurações de custo ou rede.

**2. AIService:**
- Interface única para chamadas de API, obrigando a verificação de `AICache` e `AIGovernance` antes da execução.
