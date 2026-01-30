# Plan_Phase_6_Validation (Master_Detail & Insights Test)

**Critérios de Sucesso Pragmáticos:**

- **C1: Integridade Financeira:** O sistema bloqueia a chamada de IA se o custo estimado exceder o limite em `config.json` ou se houver `cache hit`.
- **C2: Performance de TTI (Time To Insight):** Tempo entre o `REQUEST_SUMMARY` e o `SUMMARY_READY` deve ser logado para análise de gargalo do provedor.
- **C3: Estabilidade de Layout:** O `SplitterWindow` na Aba 2 deve manter 60 FPS no scroll sem disparar recalculação de layout desnecessária.
- **C4: Validação Cross-Mode:** A alteração de provedor (OpenAI -> Ollama) no `config.json` deve ser assimilada pelo `AIService` sem crash no próximo uso.
