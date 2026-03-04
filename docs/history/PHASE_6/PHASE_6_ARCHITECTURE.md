# 2️⃣ PHASE\_6\_ARCHITECTURE.md

## 1\. Visão Arquitetural em Camadas

A Fase 6 introduz uma separação rigorosa entre o **Estado** (o que o app sabe), a **Descoberta** (o que está disponível no ambiente) e a **Execução** (o trabalho pesado).

### As 5 Camadas de Isolamento:

1.  **Discovery Layer (`services/ai_discovery.py`):** Camada *stateless*. Sua única função é interagir com binários externos (Ollama) ou APIs (Google) para listar recursos.
    
2.  **Configuration Layer (`core/state/ai_manager.py`):** Gerencia a persistência das escolhas do usuário. Não executa lógica de IA, apenas armazena *quem* deve executar.
    
3.  **Execution Layer (`services/ai_executor.py`):** O "músculo". Transforma transcrições em resumos usando o motor selecionado. Não sabe nada sobre a UI.
    
4.  **Orchestration Layer (`core/state/task_worker.py`):** Gerencia a fila de tarefas e o semáforo de concorrência (Slots).
    
5.  **Presentation Layer (UI):** Reage às mudanças de estado via PubSub. Proibida de instanciar executores de IA diretamente.
    

## 2\. Diagrama de Fluxo Operacional (Mermaid)

```
graph TD
    %% Camada de UI
    UI[UI: DialogConfig / TabAnalysis] -->|Trigger Refresh| AD[AIDiscovery]
    UI -->|Select Model| AM[AIManager]
    UI -->|Enqueue Tasks| TW[TaskWorker]

    %% Camada de Descoberta
    AD -->|Subprocess| OL[Ollama Binary]
    AD -->|REST API| GG[Google AI Studio]
    AD -->|Publish: AI_MODELS_REFRESHED| PS[PubSub System]

    %% Camada de Orquestração e Estado
    AM -->|Persist Choice| CF[config.json]
    TW -->|Acquire Slot| SM[Semaphores: Local=1, Cloud=N]
    TW -->|Call| AE[AIExecutor]
    
    %% Camada de Execução e Persistência
    AE -->|Fetch Prompt| PT[Prompt Templates]
    AE -->|Compute| OL
    AE -->|Compute| GG
    AE -->|Return Struct| TW
    TW -->|Write Atomic| DB[(SQLite: video_insights)]
    TW -->|Publish: RESUMO_PRONTO| PS
    
    %% Feedback para UI
    PS -->|Notify| UI

```

## 3\. Contratos de Interface (Assinaturas Críticas)

### 3.1. `AIDiscovery` (Stateless Service)

-   `get_available_models() -> Dict[str, List[str]]`: Retorna dicionário mapeando provedor para lista de nomes de modelos.
    
-   `check_ollama_status() -> bool`: Verifica se o serviço local está acessível.
    

### 3.2. `AIManager` (State Manager)

-   `set_selected_model(provider: str, model: str) -> None`: Grava escolha no config.
    
-   `get_current_config() -> AIConfigDTO`: Retorna objeto imutável com modelo/provedor ativos.
    
-   `is_locked(provider: str) -> bool`: Informa se a UI deve bloquear alterações para aquele provedor.
    

### 3.3. `TaskWorker` (Orchestrator)

-   `add_to_queue(video_ids: List[str]) -> str`: Adiciona vídeos à fila e retorna ID da sessão.
    
-   `get_queue_status() -> List[TaskStatusDTO]`: Status para a barra de progresso.
    

## 4\. Estratégia de Concorrência (Slots)

Para manter a **Soberania do Usuário** e a **Estabilidade do Sistema**, a execução seguirá a política de slots:

-   **Provider: OLLAMA:** Máximo de **1 tarefa** ativa. Novas tarefas ficam em `PENDING`.
    
-   **Provider: GOOGLE:** Máximo de **3 tarefas** simultâneas (configurável para evitar Rate Limit 429).
    
-   **Isolamento:** Uma falha no Ollama não interrompe uma tarefa em andamento no Google.
    

## 5\. Mapeamento de Arquivos

### 📂 Arquivos a CRIAR (Novos Módulos)

| Arquivo | Responsabilidade |
| --- | --- |
| core/state/state_manager.py | Fachada principal que substitui o app_state.py antigo. |
| core/state/video_store.py | Isolamento do CRUD de vídeos (SQLAlchemy/SQLite). |
| core/state/ai_manager.py | Gestão de configuração e travamento de provedores. |
| services/ai_discovery.py | Varredura de modelos disponíveis no sistema/API. |
| services/ai_executor.py | Lógica de prompt e comunicação com LLMs. |

### 📂 Arquivos a REESTRUTURAR (Refatoração Bisturi)

| Arquivo | Mudança Necessária |
| --- | --- |
| core/app_state.py | Transformar em Facade. Deve apenas delegar chamadas para os novos módulos em core/state/. |
| storage/db_handler.py | Inclusão de migrações para as tabelas video_insights e video_tags. |

### 📂 Arquivos PROTEGIDOS (Não alterar)

-   `ui/virtual_table.py`: O motor de renderização da grade não deve ser tocado.
    
-   `core/pubsub.py`: O sistema de mensagens é o alicerce estável.
    

## 6\. Política de Rollback e Invariantes

-   **Invariante de Dados:** Nunca exibir um resumo na UI que não possua um registro correspondente com `status='COMPLETED'` no banco de dados.
    
-   **Invariante de UI:** O dropdown de modelos deve ser desabilitado (`Disable()`) se o `AIManager.is_locked()` retornar verdadeiro para o provedor atual.
    
-   **Rollback:** Se a refatoração da `app_state` falhar nos testes de integridade da Fase 5, a implementação deve ser revertida para o commit `PRE_PHASE_6`.
    

* * *

> **Aprovação de Arquitetura:** Este documento elimina a ambiguidade de "onde colocar o código". Qualquer lógica de IA fora dos serviços definidos será considerada violação estrutural.
