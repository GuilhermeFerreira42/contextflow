# 3️⃣ PHASE\_6\_TECH\_SPECS.md

## 1\. Modelo de Dados (Schema SQL)

A persistência da Fase 6 é aditiva e relacional. As alterações abaixo devem ser aplicadas via script de migração no `db_handler.py`.

```
-- Tabela de Insights (Resumos Estruturados)
CREATE TABLE video_insights (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    video_id TEXT NOT NULL,
    model_used TEXT NOT NULL,
    provider TEXT NOT NULL,
    system_prompt_hash TEXT NOT NULL, -- Para rastrear versão da lógica de resumo
    raw_response TEXT,                -- Resposta bruta da IA para debug
    parsed_json TEXT NOT NULL,        -- Conteúdo estruturado (ID, Tópico, Análise)
    token_input INTEGER NOT NULL,
    token_output INTEGER NOT NULL,
    processing_ms INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE
);

-- Sistema de Tags (M2M)
CREATE TABLE video_tags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tag_name TEXT NOT NULL UNIQUE COLLATE NOCASE,
    source TEXT NOT NULL CHECK(source IN ('ai', 'manual')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE rel_video_tags (
    video_id TEXT NOT NULL,
    tag_id INTEGER NOT NULL,
    confidence REAL DEFAULT 1.0,
    PRIMARY KEY (video_id, tag_id),
    FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE,
    FOREIGN KEY (tag_id) REFERENCES video_tags(id) ON DELETE CASCADE
);

-- Controle de Fila Persistente (Recuperação de Falhas)
CREATE TABLE ai_tasks (
    task_id TEXT PRIMARY KEY,
    video_id TEXT NOT NULL,
    provider TEXT NOT NULL,
    model TEXT NOT NULL,
    state TEXT NOT NULL DEFAULT 'IDLE', -- IDLE, RUNNING, COMPLETED, FAILED
    priority INTEGER DEFAULT 0,
    attempts INTEGER DEFAULT 0,
    last_error TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP
);

-- Extensão da Tabela Videos (Cache de Tokens)
ALTER TABLE videos ADD COLUMN tokens_gpt INTEGER DEFAULT 0;
ALTER TABLE videos ADD COLUMN tokens_gemini INTEGER DEFAULT 0;
ALTER TABLE videos ADD COLUMN tokens_llama INTEGER DEFAULT 0;

```

## 2\. Máquina de Estados Formal (AI Task Life Cycle)

| Estado Inicial | Evento | Próximo Estado | Ação Associada |
| --- | --- | --- | --- |
| None | ENQUEUE | IDLE | Adição do registro na tabela ai_tasks. |
| IDLE | ACQUIRE_SLOT | RUNNING | Verificação de disponibilidade de Slot (Ollama/Google). |
| RUNNING | SUCCESS | COMPLETED | Escrita atômica em video_insights + rel_video_tags. |
| RUNNING | ERROR | FAILED | Registro do erro; liberação imediata do Slot. |
| FAILED | RETRY | IDLE | Reset de tentativas e incremento do contador attempts. |
| COMPLETED | DELETE | None | Limpeza de registros vinculados. |

## 3\. Estruturas Imutáveis (DTOs)

Para garantir que a IA executora não altere assinaturas, os dados devem transitar entre camadas usando estas estruturas:

```
from dataclasses import dataclass
from typing import List, Optional

@dataclass(frozen=True)
class AIConfigDTO:
    provider: str      # 'ollama' | 'google'
    model: str         # Nome do modelo retornado pelo discovery
    use_checkout: bool # Preferência de aviso prévio

@dataclass(frozen=True)
class InsightBlockDTO:
    id: int
    topic: str
    analysis: str
    tags: List[str]

```

## 4\. Requisitos Funcionais Detalhados (RF)

-   **RF-01 (Discovery):** O serviço deve executar `ollama list` e capturar apenas a coluna "NAME".
    
-   **RF-02 (Token Counter):** Implementar lógica específica para `tiktoken` (OpenAI), `google-generativeai` (Gemini) e contagem por caracteres (Llama/Ollama - fallback seguro).
    
-   **RF-03 (Batch Processing):** A fila deve processar sequencialmente para Local e paralelamente (até 3) para Cloud.
    
-   **RF-04 (Isolamento):** O prompt de sistema deve preceder cada transcrição, garantindo que o modelo não carregue "ruído" de resumos anteriores na mesma sessão de API.
    

## 5\. Requisitos Não Funcionais (RNF)

-   **RNF-01 (Performance):** A contagem de tokens para uma fila de 10 vídeos não deve exceder 2 segundos.
    
-   **RNF-02 (Concorrência):** Uso obrigatório de `threading.Semaphore` para gerenciar slots de execução.
    
-   **RNF-03 (Resiliência):** Ao reiniciar o app, o `TaskWorker` deve consultar `ai_tasks` e retomar vídeos com estado `IDLE` ou `FAILED` (se configurado).
    

## 6\. Estratégia de Tratamento de Erros

-   **Ollama Offline:** Se o comando de sistema falhar, retornar erro claro: "Serviço Ollama não detectado. Certifique-se de que o Ollama está rodando."
    
-   **Google Rate Limit (429):** Implementar *Exponential Backoff* limitado a 3 tentativas.
    
-   **Transcrição Gigante (4h+):** Se exceder a janela de contexto do modelo, o sistema deve registrar `FAILED` com a causa "Context Window Exceeded" e não tentar novamente automaticamente.
    

* * *

> **Aprovação Técnica:** Este documento serve como o contrato final entre o design e a implementação. Qualquer alteração no schema do banco ou na máquina de estados requer revisão de impacto.

* * *

