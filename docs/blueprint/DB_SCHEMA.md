# DB_SCHEMA: Persistência para Análise

## Otimizações de Performance
* O `AppState` deve ser otimizado para snapshots rápidos de leitura, permitindo que a Aba 2 renderize dados (objetivo: 10.000 vídeos) sem bloquear a thread de escrita do `Processor`.
* Coluna `transcript` na tabela `videos` deve ser migrada para tabela dedicada ou comprimida com `zlib` (BLOB) para não pesar queries de listagem.
