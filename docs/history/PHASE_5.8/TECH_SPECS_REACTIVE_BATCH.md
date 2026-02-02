# docs/history/PHASE_5.8/TECH_SPECS_REACTIVE_BATCH.md

Este documento detalha as especificações técnicas para restaurar a reatividade funcional da **Aba 1 (TabBatch)**, garantindo a sincronização contínua entre o motor de processamento e a interface de usuário.

### 1. Unificação de Visualização (Atomic Snapshot)
O requisito central para a fluidez da Aba 1 é a unificação imediata de dados em memória e dados persistidos.
*   O método `_refresh_grid` deve realizar uma soma atômica de estados através do `AppState`, combinando o retorno de `get_active_downloads()` com `get_all_videos()`.
*   Esta abordagem garante que **tarefas em fila (UUID)** e **vídeos salvos (ID)** coexistam na mesma grade virtual, eliminando o atraso visual entre o clique em "Processar" e o surgimento do item na lista.

### 2. Motor de Virtualização e 11 Colunas
A **VirtualVideoTable** deve ser configurada para suportar a densidade de informações do padrão HeidiSQL, mantendo a performance para 10.000 itens.
*   A ordem mandatória das colunas é: **# (Índice), [x] (Seleção), Thumb, Título, Canal, Publicado, Adicionado, Playlist, Duração, Tokens e Status**.
*   O motor deve processar o snapshot de dados e renderizar células em menos de **0.1ms** para evitar latência no scroll.
*   A lógica de identificação deve ser híbrida, verificando o campo `id` para registros no SQLite e o campo `uuid` para tarefas temporárias, garantindo que a **seleção de itens** funcione em qualquer estado do ciclo de vida.

### 3. Protocolo de Reatividade e Thread-Safety
A estabilidade do sistema depende da comunicação assíncrona segura entre as threads do `Processor` e a Main Thread da UI.
*   A `TabBatch` deve se registrar como **observadora oficial** do `AppState` via `register_observer`, recebendo notificações automáticas de qualquer mutação de estado.
*   É mandatório o uso de **`wx.CallAfter`** em todos os callbacks de notificação para garantir a integridade da GUI e evitar fechamentos repentinos do aplicativo.
*   Implementação de um **timer de debouncing de 250ms** (Restart-on-Event) para silenciar atualizações excessivas na grade durante ingestões massivas, protegendo o processador de picos de renderização.

### 4. Telemetria Visual de Status
A coluna de Status deve fornecer feedback imediato sobre a saúde da infraestrutura e o progresso das tarefas.
*   Os estados refletidos devem incluir **QUEUED, DOWNLOADING, PROCESSING, COMPLETED e ERROR**.
*   O uso de cores para triagem rápida é obrigatório: **vermelho** para falhas críticas (ex: erro 429) e **verde** para conclusões bem-sucedidas.
*   A integração com o **System Log** na base da tela permite que mensagens técnicas detalhadas acompanhem as mudanças de status na grade.