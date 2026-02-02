# MOTOR REATIVO: ATOMIC SNAPSHOT

## Padrão
O ContextFlow utiliza o padrão **Atomic Snapshot** para sua grade virtual (`VirtualVideoTable`).

## Funcionamento
Diferente de sistemas que observam itens individuais, a UI solicita um snapshot completo e atômico do `AppState` em cada ciclo de debouncing (250ms).

1. **Unificação**: O `AppState` combina `_active_downloads` (UUID) e `_videos` (DB) em uma única lista temporária.
2. **Virtualização**: A lista unificada é entregue à `VirtualVideoTable`.
3. **Notificação**: A tabela virtual calcula a diferença de linhas e notifica a `wx.grid` via `GRIDTABLE_NOTIFY_ROWS_APPENDED` ou `DELETED`.

## Benefícios
- **Latência Zero**: Scroll fluído mesmo em 10k itens (O(1) access).
- **Sem Desperdício**: A UI não precisa manter dicionários de widgets, apenas renderizar texto bruto.
