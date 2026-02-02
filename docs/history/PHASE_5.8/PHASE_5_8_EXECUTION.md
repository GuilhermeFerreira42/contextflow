# PHASE 5.8 EXECUTION: Roteiro de Refatoração da Aba 1

> **Status:** SSoT (Fonte Única de Verdade)
> **Alvo Primário:** `ui/tab_batch.py`
> **Alvo Secundário:** `ui/virtual_table.py`

## 1. Preparação: Saneamento do Motor de Virtualização

Antes de reconstruir a interface, o "motor" das colunas deve ser ajustado para refletir a densidade de dados da Fase 5.6.

* **Ação:** Atualizar `ui/virtual_table.py`.
* **Ajuste de Colunas:** Reordenar o array `self.col_labels` para a sequência exata de 11 colunas: 
    1. `#` (Índice)
    2. `[x]` (Seleção)
    3. `Thumb`
    4. `Título`
    5. `Canal`
    6. `Publicado`
    7. `Adicionado`
    8. `Playlist`
    9. `Duração`
    10. `Tokens`
    11. `Status`
* **Lógica de Índice:** Implementar no método `GetValue` a lógica para a Coluna 0 retornar `row + 1`.

## 2. Reconstrução da UI (`ui/tab_batch.py`)

A reconstrução deve seguir a **Lei da Estabilidade Estática**, eliminando qualquer lógica de redimensionamento dinâmico (Splitters) que possa ter vazado da Fase 5.7.

### Passo 1: O Container de Ingestão (Topo)

* Utilizar `wx.StaticBoxSizer` com o rótulo "Adicionar URLs".
* Implementar o `wx.TextCtrl` com estilo `wx.TE_MULTILINE` e altura fixa (aprox. 100px).
* Posicionar os botões `btn_process` e `btn_clear` alinhados à direita no sub-sizer de comandos.

### Passo 2: A Grade Principal (Centro)

* Instanciar a `wx.grid.Grid` e vincular à `VirtualVideoTable` atualizada.
* **Configuração de Colunas:** Aplicar os tamanhos de pixel definidos no mockup para garantir que o "Título" e o "Link" tenham espaço adequado, enquanto colunas como "Tokens" e "Duração" permaneçam compactas.
* **Estilização:** Ativar linhas de grade e cores de status (Vermelho para `ERROR` e Verde para `COMPLETED`) via `GridCellAttr`.

### Passo 3: A Barra de Ações Operacionais (Rodapé)

* Criar um `wx.BoxSizer` horizontal para os botões de ação em massa.
* Implementar a lógica de vinculação para os botões:
    * **Excluir:** Chamar `app_state.delete_videos(selected_ids)`.
    * **Unificar:** Chamar `ExportService.export_batch(ids, "markdown_single")`.
    * **Exportar (ZIP):** Chamar `ExportService.export_batch(ids, "zip")`.

## 3. Integração e Comunicação (PubSub)

Para manter o **Isolamento Zero-Knowledge**, a Aba 1 não deve enviar comandos para a Aba 2.

* **Input:** Ao clicar em "Processar Fila", disparar `PubSub.sendMessage('REQUEST_BATCH_PROCESSING', urls=txt)`.
* **Output:** Inscrever a aba nos tópicos `TASK_PROGRESS` e `TASK_ERROR` para atualizar o rótulo de status no rodapé em tempo real.
* **Refresh:** Inscrever a aba em `VIDEO_UPDATED` e `VIDEOS_DELETED` para disparar o `ForceRefresh()` da grid sempre que o banco de dados mudar.

## 4. Finalização: Limpeza de Código

* Remover qualquer importação de `wx.SplitterWindow`.
* Remover métodos de "Análise" ou "Resumo" que possam ter sido herdados indevidamente.
* Garantir que o `System Log` (ConsolePanel) seja instanciado na base através da `app_window.py`, compartilhando o sizer vertical da Aba 1.
