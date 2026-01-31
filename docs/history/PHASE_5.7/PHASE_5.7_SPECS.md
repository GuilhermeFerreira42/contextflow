# PHASE 5.7 SPECS (A Nova Topologia)

## 1. Extinção do Legado
*   **Arquivo a Excluir:** `ui/panel_grid.py`
*   **Motivo:** O compartilhamento do `GridPanel` entre as abas "Dados" e "Dashboard" causava vazamento de estado visual e cálculos de layout conflitantes (UI Leak).

## 2. Nova Estrutura de Abas

### 2.1. Aba 1: Batch Entry (`ui/tab_batch.py`)
*   **Função:** Ponto de entrada único para novas URLs e monitoramento de progresso de download.
*   **Componentes:**
    *   `wx.TextCtrl` (Multiline) para entrada de URLs.
    *   Botões "Processar Fila" e "Limpar".
    *   `wx.StaticText` para status da tarefa ativa.
*   **Restrições Técnicas:**
    *   **Layout:** Uso exclusivo de `wx.BoxSizer`.
    *   **Proibição:** Não deve conter `wx.SplitterWindow` ou `VirtualVideoTable`.
    *   **Objetivo:** Simplicidade e estabilidade máxima.

### 2.2. Aba 2: Cockpit do Analista (`ui/tab_analysis.py`)
*   **Função:** Triagem, filtragem e análise profunda dos vídeos processados.
*   **Estrutura Topológica:**
    *   Baseada em `wx.SplitterWindow` para visualização **Master-Detail**.
    *   **Master (Top Pane):** Instância exclusiva da `VirtualVideoTable` para exibição de centenas de registros em alta performance.
    *   **Detail (Bottom Pane):** Painel de Resumo/Insights (Placeholder inicial).
*   **Comportamento do Splitter:**
    *   **Estado Inicial:** Deve iniciar em modo `Unsplit` (detalhes ocultos).
    *   **Objetivo:** Foco total na triagem inicial, expandindo para análise apenas sob demanda.

## 3. Fluxo de Navegação
*   A Aba 3 (`ui/panel_detail.py`) permanece como a visão imersiva (Full Read), recebendo dados tanto da `Sidebar` quanto da nova `TabAnalysis`.
