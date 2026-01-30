# PHASE 6 FLOWS (FLUXOS REFORMULADOS)

**Fluxo de Resumo Pragmatico (Data-First):**
1. **Trigger:** Seleção de vídeo ou Clique em "Resumir".
2. **Cache Check:** `SELECT * FROM summaries WHERE video_id = ?`. If exists, 7.
3. **Governance Check:** Estimativa de tokens via `tiktoken`. Validação de saldo/limite.
4. **Async Request:** Chamada ao `AIService` em thread separada.
5. **Persistence:** `INSERT INTO summaries` + `UPDATE videos.status`.
6. **Notification:** `PubSub.publish('SUMMARY_READY', video_id)`.
7. **UI Update:** Atualização reativa do painel `Detail` e da Grid Virtual.
