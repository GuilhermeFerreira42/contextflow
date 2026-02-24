
**Gestão de Estado (Live Context)**
*   **Sincronia Global:** O resumo em streaming reside no `AppState._live_analysis_buffer`. Ambas as abas (2 e 3) assinam o mesmo tópico PubSub. Se o usuário trocar de aba durante o processamento, a nova aba lê o buffer parcial instantaneamente, garantindo a **SSoT (Single Source of Truth)**.

**Modularização Zero-Knowledge**
*   **TokenEngine Isolation:** O `TokenEngine` não importa o `ConfigManager`. Ele recebe o `provider_name` e o `text` como argumentos puros. Isso evita importações circulares e permite o **Lazy Loading** de dicionários de tokens, mantendo a RAM **< 250MB**.

**Padrões de Persistência**
*   **Imutabilidade de Cache:** O `prompt_hash` é calculado via SHA256 (Texto da Transcrição + Prompt System). Qualquer alteração no prompt invalida o cache, forçando nova requisição para garantir precisão.
