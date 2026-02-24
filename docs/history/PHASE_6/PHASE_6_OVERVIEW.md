
**Objetivo de Negócio**
Consolidar o ContextFlow como uma **Estação Analítica LLM Agnóstica**. O foco é a conversão de transcrições brutas em inteligência competitiva através de resumos e triagem automatizada, garantindo que o Analista Solo tenha controle total sobre custos e hardware.

**Problema Resolvido**
Elimina o "Ponto Cego de OpenAI" e a latência de análise manual. Resolve a instabilidade de interface durante o consumo de modelos locais e a inconsistência de dados entre as abas de análise.

**Escopo Fechado**
*   **Inclui:**
    *   **Multi-Backend:** Suporte a 7 provedores (Anthropic, Gemini, OpenAI, Groq, Ollama, Azure, OpenRouter).
    *   **Batch Summarizer:** Processamento em lote com seleção via checkbox.
    *   **Cockpit Analítico (Aba 2):** Interface reativa com renderização Markdown.
    *   **Governança de Hardware:** Trava de concorrência para execução local.
*   **Não Inclui:**
    *   Busca Semântica/RAG (Postergado para Fase 7).
    *   Chat interativo com vídeo.
    *   Interface de Temas/Modo Escuro.

**Riscos Estratégicos**
*   **Risco de Capital:** Chamadas de API sem auditoria de tokens (Resolvido via Calculadora Universal).
*   **Risco de UX:** Jitter de interface em streaming (Resolvido via Protocolo de Buffer).
*   **Risco de Ambiente:** Falha do WebView no Windows (Resolvido via Renderizador de Fallback).
