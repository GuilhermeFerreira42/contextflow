# PHASE 5.7 EXECUTION (Roteiro de Refatoração)

## Passo 1: Criação da TabBatch
*   **Arquivo:** `ui/tab_batch.py`
*   Migrar o código de `ui/panel_grid.py` referente aos controles de input (`txt_input`, botões de processar) e handlers de PubSub de progresso.
*   Garantir layout limpo e estático.

## Passo 2: Criação da TabAnalysis
*   **Arquivo:** `ui/tab_analysis.py`
*   Migrar a implementação da `wx.grid.Grid` e a conexão com a `VirtualVideoTable`.
*   Envolver a Grid em um `wx.SplitterWindow`.
*   Configurar o Splitter para `Unsplit(detail_panel)` no `__init__`.

## Passo 3: Reconfiguração da Janela Principal
*   **Arquivo:** `ui/app_window.py`
*   Importar `TabBatch` e `TabAnalysis`.
*   Remover a instância de `GridPanel`.
*   Atualizar o `wx.Notebook` para usar as novas classes.

## Passo 4: Limpeza de Obsoletos
*   **Ação:** Deletar permanentemente o arquivo `ui/panel_grid.py`.
*   **Verificação:** Executar busca (`grep`) por referências restantes ao arquivo deletado.

## Passo 5: Verificação de Sanidade
*   Executar o `Plan_Phase_5.7_Validation` para garantir que a topologia está correta.
