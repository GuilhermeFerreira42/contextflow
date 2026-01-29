# PHASE 6 EXECUTION (PLANO DE ATAQUE REFORMULADO)

**Diretriz:** Prioridade ao Fluxo de Dados e Validação de Custo (Back-to-Front).

1. **Sprint 6.1: Core IA & AIService (O Motor):**
   - Implementação do plugin `AIService` (OpenAI/Ollama).
   - Validação do fluxo de tokens e custos em ambiente real.
   - Implementação da tabela `summaries` e lógica `cache_first`.
   - *Sucesso:* Resumo gerado e persistido no DB sem depender de UI.

2. **Sprint 6.2: Integração Master-Detail Estática:**
   - Implementação do `SplitterWindow` na Aba 2.
   - Painel de Detalhes fixo ou manual (Sem "Smart Show" instável).
   - Conexão do PubSub `SUMMARY_READY` para preenchimento do painel.

3. **Sprint 6.3: Refino de UX Analítica:**
   - Implementação de Double-click para expansão de células.
   - Sistema de Sorting multi-coluna (Sorting real na Grid Virtual).

4. **Sprint 6.4: Burocracia e Polimento (Se houver ROI):**
   - Diálogo de Configurações (Apenas se a complexidade justificar, caso contrário manter via `config.json`).
   - Persistência de preferências de interface.
