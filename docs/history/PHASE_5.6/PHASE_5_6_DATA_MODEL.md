# FASE 5.6: MODELO DE DADOS (DATA MODEL)

Este documento define as alterações necessárias no banco de dados SQLite para suportar a Governança de IA e o Rastreamento de Custos.

## 1. Schema Extensions (Novas Tabelas/Colunas)

### 1.1. Tabela `ai_usage_log` (NOVA)
Tabela de auditoria para cada chamada feita à API de IA.

```sql
CREATE TABLE ai_usage_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    video_id TEXT NOT NULL,          -- FK para videos.id
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    -- Definição de Modelo
    model_name TEXT NOT NULL,        -- ex: "gpt-4-turbo"
    provider TEXT NOT NULL,          -- ex: "openai"
    
    -- Integridade e Cache
    input_hash TEXT NOT NULL,        -- SHA256(video_id + norm_text + prompt_hash)
    prompt_checksum TEXT NOT NULL,   -- Checksum do System Prompt usado
    
    -- Metadados de Custo
    input_tokens INTEGER NOT NULL,
    output_tokens INTEGER NOT NULL,
    estimated_cost REAL NOT NULL,    -- Custo calculado ANTES ($)
    actual_cost REAL,                -- Custo real RETORNADO (opcional) ($)
    billing_period TEXT NOT NULL,    -- ex: "2026-01" (Para dashboard de solvência)

    -- Telemetria de Performance (Instrumentação Granular)
    -- Telemetria de Performance (Instrumentação Granular)
    queue_wait_ms INTEGER,           -- Tempo em fila (antes do processamento)
    fetch_ms INTEGER,                -- Tempo de download/extração do texto
    llm_processing_ms INTEGER,       -- Tempo de resposta da API (Processing Duration)
    ui_render_ms INTEGER,            -- Tempo de renderização/overhead (System Overhead)
    total_tti_ms INTEGER,            -- Time To Insight (Soma dos acima + overhead)
    
    -- Status
    status TEXT NOT NULL             -- 'SUCCESS', 'FAILED', 'CACHED'
);

CREATE INDEX idx_ai_log_hash ON ai_usage_log(input_hash);
CREATE INDEX idx_ai_log_video ON ai_usage_log(video_id);
```

### 1.2. Tabela `ai_cache` (NOVA)
Armazena a resposta da IA para evitar reprocessamento.

```sql
CREATE TABLE ai_cache (
    hash_key TEXT PRIMARY KEY,       -- SHA256(video_id + norm_text + prompt_hash)
    response_json TEXT NOT NULL,     -- JSON bruto da resposta
    prompt_checksum TEXT NOT NULL,   -- Para validação cruzada
    model_version TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

## 2. Invariantes de Dados

1.  **Regra do Hash Único:** `hash_key` deve ser determinística. O mesmo texto com o mesmo prompt deve gerar SEMPRE o mesmo hash. Espaços em branco devem ser normalizados antes do hash.
2.  **Imutabilidade de Log:** Registros na `ai_usage_log` nunca devem ser deletados, mesmo se o vídeo for removido (para fins de auditoria de custo financeiro).
3.  **Relacionamento Fraco:** `ai_usage_log` usa `video_id` mas não deve ter `ON DELETE CASCADE` restritivo que apague o histórico financeiro. Se o vídeo sumir, o log fica órfão mas o custo existiu.

## 3. Estratégia de Migração

Devido ao uso de SQLite, a migração será feita via script de verificação na inicialização (`db_handler.py`):

1.  Verificar existência das tabelas `ai_usage_log` e `ai_cache`.
2.  Criar se não existirem (`CREATE TABLE IF NOT EXISTS`).
3.  Não há necessidade de migrar dados antigos, pois esta é uma feature nova.

## 4. Glossário de Campos

*   `input_tokens`: Quantidade de tokens enviados no prompt.
*   `output_tokens`: Quantidade de tokens gerados na resposta.
*   `estimated_cost`: Valor calculado internamente baseado na tabela de preços oficial (hardcoded/config) * tokens.
