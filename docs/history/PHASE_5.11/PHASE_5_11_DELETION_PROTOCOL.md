# PHASE 5.11 DELETION PROTOCOL: Nova Lógica de Exclusão e Confirmação

> **Status:** SSoT (Fonte Única de Verdade)  
> **Foco:** Expurgo do Sistema Undo, Confirmação Mandatária e Independência de Checkbox  
> **Alvos:** `core/app_state.py`, `ui/tab_batch.py` e `ui/tab_analysis.py`

---

## 1. Remoção do Sistema de Deleção Diferida (Undo)

Devido a falhas na experiência do usuário identificadas na fase anterior, o sistema de **"Lixeira Staging"** e o padrão **Undo (Snackbar)** serão permanentemente removidos para restaurar a integridade imediata dos dados.

### 1.1. Alterações no `core/app_state.py`
*   **Expurgo Técnico:** Deletar os métodos `_stage_deletion`, `undo_deletion` e `_finalize_staged_deletion`.
*   **Restauração da Função Soberana:** O método `delete_videos(ids)` voltará a executar a deleção física e imediata via `_execute_permanent_delete`.
*   **Sinalização Atômica:** Após a exclusão, o sistema deve obrigatoriamente emitir o sinal PubSub `VIDEOS_DELETED` acompanhado da lista de IDs removidos para garantir a sincronia global.

---

## 2. Menu de Contexto Soberano

A exclusão via clique direito deve ser focada na **intenção direta sobre o item**, ignorando o estado de seleção em massa (checkboxes).

### 2.1. Lógica de Captura (Aba 1 e Aba 2)
*   Ao disparar o evento `EVT_GRID_CELL_RIGHT_CLICK`, o sistema deve identificar o `video_id` (ou `uuid`) da linha sob o cursor.
*   O menu de contexto deve oferecer a opção **"🗑️ Excluir"** vinculada exclusivamente a este ID identificado.
*   **Regra de Negócio:** Esta ação não desmarca nem altera os vídeos que estão atualmente selecionados via checkbox; ela age como uma operação de "alvo único".

---

## 3. Protocolo de Confirmação Mandatária

Para prevenir a perda acidental de dados, toda ação de exclusão (seja individual via menu de contexto ou em massa via botão de rodapé) exige uma interrupção consciente.

*   **Interface:** Utilização obrigatória de `wx.MessageDialog` com o estilo `wx.YES_NO | wx.ICON_QUESTION`.
*   **Mensagem Dinâmica:**
    *   Para item único: *"Deseja excluir permanentemente o vídeo '[Título]'?"*
    *   Para múltiplos itens: *"Deseja excluir permanentemente os [X] vídeos selecionados?"*
*   **Execução:** A chamada para o `AppState` só ocorrerá se o retorno do diálogo for `wx.ID_YES`.

---

## 4. Sincronia Cross-Tab (Broadcasting)

Para resolver a falha de telas que não atualizavam após a exclusão, o protocolo de reatividade foi endurecido:

1.  **Gatilho:** O `AppState` remove os dados e limpa o `_snapshot_cache` sob lock.
2.  **Notificação:** Disparo do tópico `VIDEOS_DELETED`.
3.  **Reação na UI:**
    *   **Aba 1 & Aba 2:** Devem chamar `ForceRefresh()` e `UpdateData()` imediatamente para remover as linhas da grade virtual.
    *   **Sidebar:** Deve reconstruir o histórico de playlists/vídeos para refletir a ausência do item.
    *   **Aba 3 (Detalhes):** Se o vídeo excluído for o que está sendo lido, o painel deve ser limpo via método `Clear()`.

---

**Critério de Homologação:** Ao excluir um vídeo pelo menu de contexto da Aba 2, ele deve desaparecer instantaneamente da Aba 1 e da Sidebar, sem que o usuário precise clicar em qualquer checkbox ou reiniciar o software.
