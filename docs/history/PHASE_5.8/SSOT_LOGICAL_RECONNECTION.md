### 📄 Documento 1: SSOT_LOGICAL_RECONNECTION.md (Reconexão Lógica)

Este documento estabelece o fluxo de comunicação entre a interface de usuário e o motor de processamento, garantindo que os sinais enviados pela UI sejam efetivamente captados pelo sistema.

*   **Subscrição do Processor**: O método `add_urls` do `Processor` deve ser formalmente inscrito no tópico `'REQUEST_BATCH_PROCESSING'` do PubSub. Isso garante que, quando a `TabBatch` enviar uma lista de URLs, o processador as receba sem necessidade de acoplamento direto entre as classes.
*   **Ciclo de Vida da Tarefa**: Imediatamente após a ingestão, o `Processor` deve disparar o evento `'TASK_QUEUED'` para fornecer feedback visual instantâneo de que a tarefa entrou no sistema.
*   **Estado Único de Verdade (SSoT)**: A reatividade será restaurada transformando a `TabBatch` em um observador oficial do `AppState` através do método `register_observer`, replicando a robustez da fase 5.6.

### 📄 Documento 2: TECH_SPECS_REACTIVE_BATCH.md (Especificações Técnicas)

Para restaurar a visibilidade total das operações, a grade virtual deve processar um snapshot unificado de dados em tempo real.

*   **Unificação de Visualização**: O método `_refresh_grid` na `TabBatch` deve realizar uma soma atômica de estados: `data = self.app_state.get_active_downloads() + self.app_state.get_all_videos()`. Isso permite que tarefas em fila (UUID) e vídeos já persistidos (ID) coexistam na mesma visualização.
*   **Sincronização de Grade Virtual**: A `VirtualVideoTable` deve ser atualizada para lidar com a ambiguidade de identificadores. Na lógica de seleção e renderização, o sistema deve verificar tanto o campo `id` quanto o `uuid`, garantindo que ações em massa (Excluir, Exportar) funcionem mesmo em itens que ainda estão sendo baixados.
*   **Performance**: O processamento desse snapshot unificado deve manter a meta de latência inferior a 100ms para até 10.000 itens, utilizando o método `UpdateData` para notificações eficientes à `wx.Grid`.

### 📄 Documento 3: THREAD_SAFETY_PROTOCOL.md (Segurança e Estabilidade)

A estabilidade do app depende do isolamento correto entre as threads de trabalho (Processor) e a thread principal (UI).

*   **Uso de `wx.CallAfter`**: É mandatório que qualquer atualização de interface (labels de status, refresh de grid, diálogos de erro) disparada por um evento PubSub ou Observer seja envelopada em `wx.CallAfter`. Isso delega a execução para a MainLoop do wxPython, evitando crashes fatais por acesso concorrente à GUI.
*   **Notificação de Estado**: O `AppState` já implementa internamente o `wx.CallAfter` em seu método `_notify`. Portanto, ao registrar a `TabBatch` como observadora, as atualizações de estado vindas de mutações em threads secundárias já possuem uma camada nativa de proteção, que deve ser verificada e mantida.
*   **Isolamento Zero-Knowledge**: A restauração lógica deve garantir que a `TabBatch` opere apenas sobre os sinais do `Processor` e do `AppState`, sem qualquer dependência ou importação da `TabAnalysis` (Aba 2), preservando a integridade tática da Fase 5.8.
