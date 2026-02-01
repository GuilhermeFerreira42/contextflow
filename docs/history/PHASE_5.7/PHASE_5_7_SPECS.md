# PHASE 5.7 SPECS (Especificações de Topologia)

> **Status:** SSoT (Fonte Única de Verdade) - Versão Final Corrigida
> **Escopo:** Segregação Tática e Estabilização de Performance
> **Meta de Escala:** 10.000+ vídeos | RAM < 250MB (em carga)

## 1. Aba 1: Doca de Carga (`ui/tab_batch.py`)

Esta aba é o portal de entrada do sistema, projetada para ser leve e resiliente, operando com **Prioridade Máxima de CPU** durante processos de ingestão.

*   **Função:** Entrada massiva de URLs e monitoramento de integridade de carga.
*   **Topologia:** Layout estático baseado em `wx.BoxSizer`. É **terminantemente proibido** o uso de `wx.SplitterWindow` ou `VirtualVideoTable` nesta aba para evitar overhead desnecessário.
*   **Virtualização de Fila:** O feedback de status (ex: `ListBox` ou `ListCtrl`) deve ser virtualizado ou limitado para garantir que a interface não trave ao processar lotes de até 10.000 URLs.
*   **Contrato de Interface:** Deve exibir exclusivamente as colunas `[Status | URL | Mensagem de Erro]`.

## 2. Aba 2: Cockpit Analítico (`ui/tab_analysis.py`)

Centro de comando Master-Detail para triagem e inspeção profunda de dados já processados.

*   **Estrutura:** Layout dinâmico via `wx.SplitterWindow`.
    *   **Master (Topo):** `VirtualVideoTable` (Grid Virtualizada baseada em `AppState`).
    *   **Detail (Base):** Visualização de transcrições e metadados brutos.
*   **Protocolo Zero-Knowledge:** A Aba 2 não possui referências à Aba 1 ou Aba 3. Toda atualização de dados deve ser detectada via `PubSub` ou observers do `AppState`.

## 3. Reatividade e Debouncing (Cláusulas Pétreas)

Para suportar a meta de 10.000 vídeos sem degradar a experiência do usuário, a reatividade da Aba 2 segue regras rígidas de **Throttling**:

*   **Debouncing "Restart-on-Event" (250ms):**
    *   Qualquer sinal de atualização vindo do `Processor` (ex: tópicos `TASK_COMPLETED` ou `VIDEO_UPDATED`) deve acionar um `wx.Timer` de 250ms.
    *   **Regra de Reinício:** Se um novo evento chegar enquanto o timer estiver rodando, o timer deve ser **parado e reiniciado** imediatamente.
    *   A atualização da Grid só ocorre quando o sistema detectar um "silêncio" de eventos de 250ms, protegendo a UI de refreshes frenéticos durante ingestão massiva.
*   **Protocolo de Anti-Jitter:**
    *   A `VirtualVideoTable` deve persistir a visualização do último snapshot válido durante o período de debouncing.
    *   Refreshes parciais ou "piscadas" na interface (jitter) são proibidos. A renderização deve ser atômica após o fim do timer.
*   **Prioridade de Renderização:** A renderização da Aba 2 deve ter prioridade inferior à ingestão da Aba 1 (uso de `wx.IDLE` ou `wx.CallAfter`) para garantir que o input de URLs nunca seja bloqueado pela visualização.

## 4. Governança e Interdições Técnicas

*   **Interdição de Legado:** O arquivo `ui/panel_grid.py` é considerado inexistente para esta fase. Nenhuma classe deve tentar herdar ou importar lógica dele.
*   **Blindagem de Memória:** O `AppState` deve fornecer snapshots rápidos (`get_all_videos()`) em menos de 50ms para 10.000 itens.
*   **Esterilização de IA:** Funções de IA da Fase 6 (Botão "Resumir", Tags) estão **interditadas**. O layout da Aba 2 pode conter placeholders visuais, mas nenhuma lógica de backend ou chamada de API de IA deve ser implementada até a estabilização desta camada.
*   **Sinalização Global:** A `AppWindow` deve implementar um indicador persistente no `StatusBar` que sinalize o progresso da fila global e eventuais banimentos de IP (429), visível em todas as abas.
