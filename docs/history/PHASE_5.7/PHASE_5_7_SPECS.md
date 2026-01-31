# PHASE 5.7 SPECS (Especificações de Topologia)

## 1. Aba 1: Doca de Carga (`ui/tab_batch.py`)
Componente dedicado à ingestão massiva de dados.

*   **Função:** Entrada de URLs e feedback de integridade de carga em tempo real.
*   **Topologia:** Layout estático baseado em `wx.BoxSizer`.
*   **Proibição:** VETADO o uso de `wx.SplitterWindow` ou `VirtualVideoTable`.
*   **Feedback de Status (Obrigatório):**
    *   Uso de um componente virtualizado (`DataViewListCtrl` com modelo virtual ou Buffer limitado a 500 linhas) para garantir escalabilidade em cargas massivas (5.000+ URLs).
    *   Exclusividade: Exibir apenas [Status | URL | Mensagem de Erro].
    *   Sem thumbnails ou renders complexos para evitar overhead na thread de input.

## 2. Aba 2: Cockpit Analítico (`ui/tab_analysis.py`)
O centro de comando para triagem e inspeção profunda.

*   **Estrutura:** Layout dinâmico via `wx.SplitterWindow`.
*   **Master (Topo):** `VirtualVideoTable` (Grid Virtual).
*   **Detail (Base):** `SummaryPanel` reativo.
*   **Contrato do SummaryPanel:**
    *   **Método `Clear()`:** Obrigatório. Deve ser chamado em cada troca de seleção para evitar a persistência de "dados fantasmagóricos".
    *   **Estética:** Deve obrigatoriamente herdar o **Dark Theme CSS** padronizado (fundo `#1E1E1E`, texto `#DCDCDC`) desde a inicialização para evitar problemas de baixo contraste.
*   **Estado Inicial:** Modo **Unsplit** apresentando um template de "Boas-vindas/Instruções" no painel de detalhes.

## 3. Gestão de Global e Performance
*   **Throttling:** A Aba 2 deve implementar um mecanismo de **Debouncing Acumulativo** para o refresh da Grid.
*   **Não-Bloqueio:** Updates do `Processor` devem obrigatoriamente usar `wx.CallAfter`. O `AppState` deve ser otimizado para snapshots rápidos de leitura, reduzindo a contenção de `RLock`.
*   **Sinalizador de "Carga em Curso":** A `AppWindow` deve implementar um indicador visual persistente no `StatusBar` (Rodapé), informando o status global da fila (Ativa/Parada/Erro Fetal) visível em qualquer aba.
