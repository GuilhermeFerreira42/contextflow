# BACKLOG FUTURO: ContextFlow

> **Nota:** Este documento contém as fases planejadas que estão atualmente **interditadas** para garantir a estabilidade da infraestrutura física (Fase 5.7).

## 🔒 FASE 6: Insights e Valor (Interditada)
> **Foco:** Transformar dados brutos em informação útil.

### 6.1. Integração de IA (Opcional)
*   **Conceito:** Plugin de "Resumo".
*   **Técnica:** Chamada a API (OpenAI/Ollama) via `AIService`.
*   **Restrição:** Falha na IA não trava o app.

### 6.2. UI de Leitura Melhorada
*   Painel de leitura com formatação Markdown real (não apenas HTML injetado).
*   Busca interna no texto da transcrição.

### 6.3. Organização
*   Tags manuais e automáticas via IA.
*   Filtros inteligentes na Grid (ex: "Mostrar apenas não lidos").

---

## 🔮 FASE 7: Manutenção Zero & Escala
*   Logs de diagnóstico automatizados.
*   Update automático de binários (yt-dlp).
*   Suporte a Vetores (RAG Local).

## 🔮 FASE 8: Personalização e Filtros Avançados
*   Sistema de tags dinâmico.
*   Filtros cruzados entre canais e playlists.

---

## 🔒 Contratos Fase 6 (Insights - Bloqueado)

### AIService
*   **Request:** `generate_summary(video_id)` deve retornar objeto `SummaryResult`.
*   **Cache:** NUNCA chamar API se o resumo já existir no banco (`cache_first`).
*   **Performance (TTI):** O "Time To Insight" (tempo entre seleção e exibição do resumo) deve ser **< 15s** (considerando OpenAI). Para modelos locais, o UI não pode congelar.

### Interfaces de Configuração
*   Qualquer alteração em `SettingsDialog` deve emitir `PREFS_CHANGED` via PubSub imediatamente.
