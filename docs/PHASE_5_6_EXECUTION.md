# PHASE 5.6 EXECUTION: OPERAÇÃO "ANTIFRAGILIDADE"

> **Meta:** Transformar a documentação de blindagem em código executável sem improviso.
> **Estratégia:** Implementação em camadas, partindo do controle financeiro (interno) para a defesa de rede (externo).

## 1. SEQUÊNCIA DE ATAQUE IRREVERSÍVEL

A ordem dos fatores altera o produto. Não iniciairemos extração sem antes ter onde registrar o custo e medir a performance.

### PASSO 1: O COFRE (Governança de IA)
*   **Foco:** Garantir que nenhuma chamada de IA ocorra sem supervisão.
*   **Arquivos:** `core/ai_governance.py`, `config/ai_prices.json`, `storage/db_handler.py`.
*   **Ações:**
    1.  Implementar tabelas `ai_usage_log` e `ai_cache` (com migração segura).
    2.  Criar `AICostCalculator` lendo de `ai_prices.json`.
    3.  Implementar `TokenCounter` usando `tiktoken`.
    4.  Implementar `AICache` com hash semântico duplo.
*   **Checkpoint de Validação:**
    *   [ ] **Teste de Integridade Financeira:** Deletar um vídeo no DB e confirmar que seu registro em `ai_usage_log` permanece intacto (relacionamento fraco/auditabilidade).
    *   [ ] Teste Unitário: Calcular custo de 1k tokens e bater com tabela.
    *   [ ] Teste de Cache: Validar que alterações no Checksum do Prompt geram Cache Miss.

### PASSO 2: O PAINEL (Instrumentação de Telemetria)
*   **Foco:** Visibilidade antes da velocidade.
*   **Arquivos:** `core/metrics.py`, `core/processor.py`.
*   **Ações:**
    1.  Criar estrutura de `TimeTracker` para capturar `queue_wait`, `fetch`, `llm`, `ui`.
    2.  Alterar `Processor` para usar o tracker em cada etapa.
    3.  Persistir logs granulares em `ai_usage_log`.
*   **Checkpoint de Validação:**
    *   [ ] **Benchmark P95:** Executar lote de 5 vídeos e validar que o log reflete `fetch_ms` e `llm_processing_ms`. 
    *   [ ] Validar que o `System_Overhead` (interno) é inferior a 100ms conforme contrato.

### PASSO 3: O ESCUDO (Blindagem da Extração)
*   **Foco:** Sobreviver ao Youtube.
*   **Arquivos:** `services/youtube_manager.py`, `config/settings.json`, `core/proxy_manager.py`.
*   **Ações:**
    1.  Implementar suporte a `cookies.txt` e rotação de User-Agent.
    2.  Implementar `ProxyPool` com rotação e banimento temporário (Error 429).
    3.  Implementar `validate_infrastructure()`: bloqueia o botão "Processar" se `cookies.txt` estiver ausente ou `ProxyPool` vazio para lotes > 20.
*   **Checkpoint de Validação:**
    *   [ ] **Teste de Rotação Beta:** Simular erro 429 em um proxy e validar se o sistema o remove da lista ativa e pula para o próximo instantaneamente.
    *   [ ] Validar que o botão "Processar" é desabilitado em lote > 20 sem infraestrutura de rede validada.

### PASSO 4: O FREIO (Protocolos de Defesa & UI)
*   **Foco:** Impedir a catástrofe financeira/operacional.
*   **Arquivos:** `ui/status_bar.py`, `core/processor.py`, `storage/db_handler.py`.
*   **Ações:**
    1.  Implementar Dashboard de Rodapé (Gasto Mês) e Kill Switch de custo.
    2.  Implementar Lógica de Cooldown persistente.
    3.  Otimizar `AppState` para Lazy Loading.
*   **Checkpoint de Validação:**
    *   [ ] **Persistência de Cooldown:** Simular Erro 429 para entrar em PAUSA. Fechar o app à força. Reabrir e validar se o sistema permanece em PAUSA respeitando o tempo de espera restante.
    *   [ ] Validar bloqueio automático se custo acumulado exceder `[PARAM_SESSION_COST_LIMIT]`.

### PASSO 5: HOMOLOGAÇÃO DE CONTRATOS (Stress Test)
*   **Foco:** Garantia Final de Governança.
*   **Ação:** Processar um lote de 30 vídeos reais com proxies ativos.
*   **Critérios de Sucesso:**
    1.  **Atingimento P95:** Tempo Total de Ingestão (TTI) P95 < 120s para o lote.
    2.  **Solvência:** Dashboard de rodapé atualizado em tempo real.
    3.  **Kill Switch:** Forçar um limite baixo ($0.01) e validar se o processamento é interrompido imediatamente com aviso.

---

## 2. DEFINIÇÃO NEGATIVA (O QUE NÃO FAZER)

*   ❌ **UX Criativa:** Nenhuma mudança visual além do Dashboard de Rodapé e Modais de Erro.
*   ❌ **Engenharia de Prompt:** Não alterar o texto dos prompts existentes.
*   ❌ **Refatoração Estética:** Se o código funciona e não viola a blindagem, não toque.

---

## 3. CRITÉRIOS DE ABORTAR (ROLLBACK)

1.  **Custo de Bloqueio:** Se o Lazy Loading exigir reescrever toda a `VirtualTable`, usar paginação simples.
2.  **Complexidade do Proxy:** Se a rotação de proxy exigir dependências binárias instáveis, abortar para proxy único.
