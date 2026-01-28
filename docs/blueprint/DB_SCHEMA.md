# DB_SCHEMA: Persistência para Análise

## Novas Tabelas (Fase 6+)
1. **`video_tags`**: Relacionamento 1:N com `videos`. Armazena tags geradas por IA (ex: "Tutorial", "Vendas").
2. **`summaries`**: Relacionamento 1:1 com `videos`.
   - `short_summary`: Texto para o painel rápido.
   - `key_points`: JSON com bullet points.
   - `ai_verdict`: Avaliação automática (ex: "Conteúdo Rico", "Clickbait").

## Otimizações
* Coluna `transcript` na tabela `videos` deve ser migrada para tabela dedicada ou comprimida com `zlib` (BLOB) para não pesar queries de listagem.
