# CONTRATOS E GARANTIAS DO SISTEMA

> **Objetivo:** Definir interfaces rígidas que não podem ser quebradas sem refatoração maior.
> **Vigência:** Fase 5.7 (Segregação Tática).

## 1. PubSub Eventos (`core/pubsub.py`)

O barramento de eventos é o único meio de comunicação do Core (`Processor`) para a UI.

| Tópico | Payload (Kwargs) | Descrição | Quem Emite? | Quem Ouve? |
| :--- | :--- | :--- | :--- | :--- |
| `TASK_QUEUED` | `uuid`, `url` | Novo item adicionado à fila de processamento. | Processor | UI, Logs |
| `TASK_STARTED` | `uuid` | Início efetivo do processamento (worker pegou da fila). | Processor | UI |
| `METADATA_FETCHED` | `uuid`, `video_id`, `title` | ID real do YouTube descoberto. Momento de promover UUID -> ID. | Processor | Processor, UI |
| `TASK_PROGRESS` | `video_id`, `status_msg` | Atualização de progresso textual (ex: "Baixando..."). | Processor | UI (Status Bar) |
| `TASK_COMPLETED` | `video_id`, `data_dict` | Processamento finalizado com sucesso. Dados persistidos. | Processor | UI (Grid Refresh) |
| `TASK_ERROR` | `video_id`, `error_msg` | Falha fatal no processamento. | Processor | UI (Red Color, Log) |

**Regras:**
*   Argumentos são passados como `kwargs`.
*   Subscribers devem tratar exceções para não travar o Publisher.
*   Subscribers de UI devem usar `wx.CallAfter` se tocarem em componentes gráficos.

## 2. AppState (`core/app_state.py`)

O `AppState` é a Single Source of Truth.

### Garantias de Performance
*   **Snapshot Rápido:** `get_all_videos()` deve retornar em **< 50ms** para 10.000 itens.
*   **Non-Blocking:** Leituras não devem bloquear escritas por mais de 5ms.

### Garantias de Concorrência
*   **Thread Safety:** Todos os métodos públicos de escrita (`add_or_update`, `delete`) usam `RLock`.
*   **Atomicidade:** Atualizações de memória e disparo de notificação (`VIDEO_UPDATED`) ocorrem atomicamente sob lock (ou ordem garantida).

## 3. VirtualTable (`ui/virtual_table.py`)

A tabela virtual é a única visualização permitida para listas longas.

### Interface
*   Deve implementar `wx.grid.GridTableBase`.
*   Deve consumir dados via `AppState.get_all_videos()` + `AppState.get_active_downloads()`.
*   Não deve manter cópia profunda dos dados (apenas referência ou snapshot leve).

### Performance
*   **Render:** O método `GetValue(row, col)` deve retornar em **< 0.1ms**.
*   **Lógica:** Nenhuma formatação pesada (ex: parsing de data complexo) dentro do `GetValue`. Dados devem vir pré-formatados ou ser formatados de forma trivial.

## 4. Serviços de Exportação (`services/export_service.py`)

*   **Independência:** Deve aceitar lista de IDs e funcionar mesmo sem `wx.App` instanciado (usado em testes).
*   **Feedback:** Aceita callback de progresso genérico.

