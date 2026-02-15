# PHASE 5.10 INDUSTRIAL CORE: Worker Pool e Otimização de Snapshot

> **Status:** SSoT (Fonte Única de Verdade)  
> **Foco:** Performance Extrema, Estabilidade de Escrita e Eficiência de CPU  
> **Alvos:** `core/processor.py` e `core/app_state.py`

---

## 1. Orquestração de Concorrência: ThreadPoolExecutor

Identificou-se que o sistema atual sofre com a **criação indiscriminada de threads** no `Processor` para cada resolução de URL e persistência de dados. Sob carga massiva (ex: ingestão de playlists), isso resulta em picos de CPU e erros de **"Database is locked"** no SQLite devido a conexões simultâneas descontroladas.

### 1.1. Migração para Worker Pool
O modelo de threads avulsas (`threading.Thread`) será substituído por um **`ThreadPoolExecutor`** fixo no arquivo `core/processor.py`.
*   **Capacidade de Workers:** O pool terá um tamanho base controlado (ex: 4 workers) para operações de rede e I/O.
*   **Limites Dinâmicos (Cloud vs Local):** O executor deverá respeitar os limites configurados no `credentials.json` [PHASE_5_10_CONFIG_SPECS].
    *   **API de Nuvem:** Suporte a até 4 tarefas simultâneas para maximizar o throughput de rede.
    *   **Ollama (Local):** Trava mandatória em **1 tarefa**, impedindo que modelos de IA locais sequestrem 100% da CPU/GPU e congelem a interface do usuário.

### 1.2. Proteção de I/O de Banco de Dados
Todas as operações de escrita disparadas pelo `AppState` (como o `_persist_video_worker`) serão centralizadas no Pool de Workers. Isso garante uma fila sequencial de persistência, eliminando condições de corrida (Race Conditions) e travamentos de arquivo no SQLite.

---

## 2. Otimização de Estado: Snapshot Caching

Atualmente, o método `get_unified_data` reconstrói, filtra UUIDs e ordena a lista completa (O(n log n)) em **cada chamada** disparada pelo timer de 250ms da UI. Em bibliotecas de 10.000 itens, esse custo computacional gera latência visual e overhead desnecessário.

### 2.1. Implementação do Cache de Snapshot
O `AppState` passará a manter uma versão **"Unificada e Ordenada"** persistente em memória RAM.
*   **Lógica de Invalidação (Dirty Flag):** O cache só será reconstruído quando houver uma mutação real de estado (eventos `VIDEO_ADDED`, `VIDEOS_DELETED` ou `VIDEO_PROMOTED`).
*   **Leitura Instantânea:** Chamadas subsequentes de `get_unified_data` retornarão apenas a referência ao snapshot já processado.
*   **Impacto:** Redução esperada de **40% na latência** de resposta da interface em bibliotecas massivas.

---

## 3. Diretrizes de Thread-Safety e Reatividade

### 3.1. Governança de Lock
O uso de **`threading.RLock`** permanece mandatório para proteger as mutações no dicionário `_videos` e no novo Cache de Snapshot. O bloqueio deve ser breve, cobrindo apenas a atualização da memória e a sinalização de "sujeira" (dirty flag) no cache.

### 3.2. Sincronia de UI (wx.CallAfter)
Garante-se que todas as notificações do `AppState` enviadas aos observadores da interface continuem utilizando **`wx.CallAfter`**. Isso delega a execução para a thread principal, prevenindo crashes por manipulação gráfica em threads de background.

---

## 4. Especificações Técnicas de Implementação

| Recurso | Arquivo | Ação Técnica |
| :--- | :--- | :--- |
| **Worker Pool** | `processor.py` | Instanciar `concurrent.futures.ThreadPoolExecutor` com limites dinâmicos. |
| **Dirty Flag** | `app_state.py` | Adicionar boolean `_cache_dirty` e variável `_snapshot_cache`. |
| **Lazy Update** | `app_state.py` | Modificar `get_unified_data` para retornar o cache se `not _cache_dirty`. |
| **Sync DB** | `db_handler.py` | Garantir que o Handler suporte acesso via Workers de thread curta. |

---
**Critério de Homologação:** O sistema deve processar um lote de 50 vídeos reais via Ollama (simulado) enquanto mantém o scroll da grade de 10.000 itens em **60 FPS**, sem apresentar erros de banco de dados bloqueado no console.
