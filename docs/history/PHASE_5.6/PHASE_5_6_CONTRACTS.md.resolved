# FASE 5.6: CONTRATOS OPERACIONAIS

Este documento define as regras imutáveis que regem o comportamento do sistema. Nenhuma implementação pode violar estes contratos.

> **IMPORTANTE:** Todos os valores numéricos são representados por Placeholders (`[PARAM_...]`) e DEVEM ser parametrizáveis via configuração, nunca hardcoded no código.

---

## 1. Contrato de Extração (Extraction Contract)

### 1.1. Definições de Estado
*   **SUCESSO:** Metadados + Transcrição (Oficial ou Whisper-converted) obtidos e salvos no DB.
*   **FALHA TEMPORÁRIA:** Erro de rede genérico, Timeout, HTTP 5xx. -> *Permite Retry.*
*   **FALHA FATAL:** Vídeo deletado, Privado, Geo-block. -> *Não permite Retry.*
*   **BLOQUEIO OPERACIONAL:** HTTP 429 (Too Many Requests). -> *Aciona protocolo de defesa.*

### 1.2. Protocolo de Defesa (Rollback/Abort)
*   **Regra Alpha:** Se `[PARAM_429_COUNT]` erros 429 ocorrerem em uma janela móvel de `[PARAM_WINDOW_MINUTES]` minutos:
    1.  A fila de download é **PAUSADA** imediatamente.
    2.  O sistema entra em estado `COOLDOWN` por `[PARAM_COOLDOWN_MINUTES]` minutos.
    3.  O usuário é notificado (Log/Status).
*   **Regra Beta (Proxy Mandatório para Lotes):** Se a fila de processamento contiver > 20 itens, o uso de `PROXY_URL` é **OBRIGATÓRIO**.
    *   O sistema deve impedir o início do batch se o proxy não estiver configurado/validado.
    *   Para lotes menores (teste/doméstico), o proxy é opcional mas recomendado.
*   **Regra Gama:** O User-Agent deve ser rotacionado a cada `[PARAM_UA_ROTATION_FREQ]` requisições.

---

## 2. Contrato de IA (AI Contract)

### 2.1. O Imperativo da Estimativa (Preço Dinâmico)
*   **Regra:** NENHUMA chamada à API de LLM pode ser feita sem antes:
    1.  Ler o preço atual de `config/ai_prices.json` (NUNCA hardcoded).
    2.  Calcular `input_tokens` (usando `tiktoken`).
    3.  Estimar `output_tokens` esperado.
    4.  Calcular custo financeiro estimado ($).
    5.  Obter confirmação do usuário.

### 2.2. O Imperativo do Cache (Hash Integrity Forte)
*   **Regra:** O Hash de Cache DEVE incluir o **Checksum do Prompt**.
    *   Se o desenvolvedor mudar a vírgula no prompt, o cache antigo torna-se inválido (Miss).
    *   Cache Hit só é válido se `Hash(Video + Texto + PromptVer) match`.
*   **Invariante:** Se o Hash bater, é **PROIBIDO** chamar a API.

### 2.3. Critérios de Rollback (Kill Switch)
*   Se o custo acumulado na sessão exceder `[PARAM_SESSION_COST_LIMIT]`:
    1.  Bloquear novas chamadas de IA.
    2.  Exigir senha/confirmação administrativa para liberar.

---

## 3. Contrato de Custo (Cost Contract)

### 3.1. Limites Parametrizáveis
O sistema deve respeitar os seguintes limites configuráveis:
*   `MAX_COST_PER_VIDEO`: Valor máximo ($) para gastar em um único item.
*   `MAX_COST_PER_BATCH`: Valor máximo ($) para gastar na fila atual.

### 3.2. Comportamento de Limite Atingido
*   Se `Cost(Video) > MAX_COST_PER_VIDEO`:
    *   Ação: Pular vídeo.
    *   Log: "Skipped due to cost constraint".
    *   Status: `COST_EXCEEDED`.

---

## 4. Contrato de Performance (TTI Realista)

### 4.1. Desacoplamento de Métricas
*   **Problema:** Bloqueio do YouTube não é incompetência do software.
*   **Métricas Distintas:**
    *   `Extraction_Time_P95`: Tempo para baixar (dependente de proxy/rede). Excluído de alertas de sistema, mas monitorado para *Health Check* de Proxy.
    *   `AI_Processing_Time_P95`: Tempo de resposta da LLM. Critério: < 15s.
    *   `System_Overhead_P95`: Tempo interno (DB, Hashing, UI). Critério: < 100ms (Otimização crítica para virtualização).

### 4.2. Recuperação de Cooldown (Anti-Loop)
*   **Regra:** Se o sistema reiniciar durante um Cooldown:
    1.  Itens com status `PROCESSING` revertem para `PENDING`.
    2.  O contador de `retry_count` NÃO é zerado (evita loop infinito).
    3.  Se `retry_count > MAX_RETRIES`, o item é marcado como `FAILED_PERMANENT` e removido da fila ativa.

## 5. Glossário de Placeholders (Exemplos)

| Placeholder | Descrição | Exemplo de Valor Default |
| :--- | :--- | :--- |
| `[PARAM_429_COUNT]` | Qtde de erros 429 p/ trigger | 3 |
| `[PARAM_WINDOW_MINUTES]` | Janela de tempo p/ erros | 5 |
| `[PARAM_COOLDOWN_MINUTES]` | Tempo de espera no pause | 60 |
| `[PARAM_SESSION_COST_LIMIT]` | Teto de gasto por sessão | $ 2.00 |
| `[PARAM_P95_TTI_SECONDS]` | Limite de tempo P95 | 120 |
