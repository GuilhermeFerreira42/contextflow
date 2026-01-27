# PHASE 5.6 EXECUTION: OPERAÇÃO "ANTIFRAGILIDADE"

> **Meta:** Transformar a documentação de blindagem em código executável sem improviso.
> **Estratégia:** Implementação em camadas, partindo do controle financeiro (interno) para a defesa de rede (externo).

## 1. SEQUÊNCIA DE ATAQUE IRREVERSÍVEL

### PASSO 1: O COFRE (Governança de IA) [COMPLETED]
*   **Foco:** Garantir que nenhuma chamada de IA ocorra sem supervisão.
*   **Arquivos:** `core/ai_governance.py`, `config/ai_prices.json`, `storage/db_handler.py`.
*   **Ações:**
    1.  Implementar tabelas `ai_usage_log` e `ai_cache` (com migração segura).
    2.  Criar `AICostCalculator` lendo de `ai_prices.json`.
    3.  Implementar `TokenCounter` usando `tiktoken`.
    4.  Implementar `AICache` com hash semântico duplo.
*   **Checkpoint de Validação:**
    *   [x] **Teste de Integridade Financeira:** Deletar um vídeo no DB e confirmar que seu registro em `ai_usage_log` permanece intacto.
    *   [x] Teste Unitário: Calcular custo de 1k tokens e bater com tabela.
    *   [x] Teste de Cache: Validar que alterações no Checksum do Prompt geram Cache Miss.

### PASSO 2: O PAINEL (Instrumentação de Telemetria) [COMPLETED]
*   **Foco:** Visibilidade antes da velocidade.
*   **Arquivos:** `core/metrics.py`, `core/processor.py`.
*   **Ações:**
    1.  Criar estrutura de `TimeTracker` para capturar `queue_wait`, `fetch`, `llm`, `ui`.
    2.  Alterar `Processor` para usar o tracker em cada etapa.
    3.  Persistir logs granulares em `ai_usage_log`.
*   **Checkpoint de Validação:**
    *   [x] **Benchmark P95:** Executar lote de 5 vídeos e validar que o log reflete `fetch_ms` e `llm_processing_ms`. 
    *   [x] Validar que o `System_Overhead` (interno) é inferior a 100ms conforme contrato.

### PASSO 3: O ESCUDO (Blindagem da Extração) [COMPLETED]
*   **Foco:** Sobreviver ao Youtube.
*   **Arquivos:** `services/youtube_manager.py`, `constants.py`, `core/proxy_manager.py`.
*   **Ações:**
    1.  Implementar suporte a `cookies.txt` e rotação de proxies/user-agent.
    2.  Implementar `ProxyPool` com rotação e banimento temporário (Error 429).
    3.  Implementar `PreFlightCheck` que aborta se fila > 20 sem infra de proteção.
*   **Checkpoint de Validação:**
    *   [x] **Teste de Rotação Beta:** Simular erro 429 em um proxy e validar se o sistema o remove da lista ativa.
    *   [x] Validar que o aborto de segurança funciona para filas grandes sem proxies carregados.

### PASSO 4: O FREIO (Protocolos de Defesa & Persistence) [COMPLETED]
*   **Foco:** Impedir a catástrofe financeira/operacional.
*   **Arquivos:** `core/cooldown_manager.py`, `core/processor.py`, `storage/db_handler.py`.
*   **Ações:**
    1.  Implementar Lógica de Cooldown Alpha persistente em SQLite.
    2.  Instrumentar o Processor para respeitar o estado de proteção.
*   **Checkpoint de Validação:**
    *   [x] **Persistência de Cooldown:** Simular Erro 429 para entrar em PAUSA. Fechar o app. Reabrir e validar se o sistema permanece em PAUSA.

### PASSO 5: HOMOLOGAÇÃO DE CONTRATOS (Stress Test) [PENDING]
*   **Foco:** Garantia Final de Governança.
*   **Ação:** Processar um lote de 30 vídeos reais com proxies ativos.
*   **Critérios de Sucesso:**
    1.  **Atingimento P95:** Tempo Total de Ingestão (TTI) P95 < 120s para o lote.
    2.  **Solvência:** Logs de custo gerados corretamente para todo o lote.
    3.  **Estabilidade:** Zero crashes ou travamentos de UI durante o processamento massivo.

---

## 2. DEFINIÇÃO NEGATIVA (O QUE NÃO FAZER)

*   ❌ **UX Criativa:** Nenhuma mudança visual além do Dashboard de Rodapé e Modais de Erro.
*   ❌ **Engenharia de Prompt:** Não alterar o texto dos prompts existentes.
*   ❌ **Refatoração Estética:** Se o código funciona e não viola a blindagem, não toque.

---

## 3. CRITÉRIOS DE ABORTAR (ROLLBACK)

1.  **Complexidade do Proxy:** Se a rotação de proxy exigir dependências binárias instáveis, abortar para proxy único.
2.  **Performance:** Se a telemetria introduzir overhead > 500ms, desativar logs granulares.
