# PHASE 6 DATA MODEL (MODELO DE DADOS)

**Extensões do SQLite:**
- **Tabela `summaries`:** `video_id` (PK), `short_summary`, `key_points` (JSON), `ai_verdict`.
- **Tabela `video_tags`:** `id`, `video_id`, `tag_name`.
- **Tabela `user_configs`:** Persistência de largura de colunas, visibilidade e chaves de API.
