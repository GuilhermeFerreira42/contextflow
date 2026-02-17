# PHASE 5.11 EXECUTION: Roteiro de Implementação Passo a Passo

> **Status:** SSoT (Fonte Única de Verdade)  
> **Objetivo:** Saneamento total do sistema de "Undo", implementação de sincronia global via PubSub e refinamento da inteligência de seleção e exclusão.  
> **Alvos:** `core/app_state.py`, `ui/app_window.py`, `ui/tab_batch.py`, `ui/tab_analysis.py`, `ui/sidebar.py`, `core/config_manager.py`, `ui/dialog_config.py`.

---

### Passo 1: Saneamento do Core e Persistência

1.  **`core/app_state.py`:**
    *   **Remoção:** Deletar variáveis `_trash_bin`, `_delete_timer` e métodos `_stage_deletion`, `undo_deletion` e `_finalize_staged_deletion`.
    *   **Restauração:** O método `delete_videos(ids)` deve voltar a executar a deleção física imediata via `db_handler.delete_videos`.
    *   **Broadcasting:** Após deletar, disparar `PubSub.publish('VIDEOS_DELETED', ids=ids)` para notificar todas as telas.

2.  **`core/config_manager.py`:**
    *   Adicionar novas chaves ao dicionário padrão: `extraction_defense` (cooldown_mins, errors_429_limit, use_cookies, use_proxies) e `subtitles` (language_order, fallback_auto).

---

### Passo 2: Reatividade Global e Limpeza de UI

1.  **`ui/app_window.py`:**
    *   **Limpeza:** Remover o componente `self.info_bar` (Snackbar) e desvincular handlers de desfazer exclusão.
    *   **Sincronia:** Inscrever o método `_on_videos_deleted` no tópico `VIDEOS_DELETED`. Este método deve delegar refreshes para as abas via `wx.CallAfter`.

2.  **`ui/sidebar.py`:**
    *   Inscrever a barra lateral no tópico `VIDEOS_DELETED`.
    *   **Ação:** Ao receber o sinal, chamar `self.load_history()` para reconstruir a árvore sem os itens removidos.

---

### Passo 3: Inteligência de Seleção e Exclusão Targeted

1.  **`ui/tab_batch.py` e `ui/tab_analysis.py` (Lógica de Atalho):**
    *   No método `on_key_down`, implementar o caso `wx.WXK_SPACE`:
        *   Obter linhas com destaque azul via `grid.GetSelectedRows()`.
        *   Inverter o estado do checkbox da primeira linha selecionada e replicar para todas as outras no bloco.
        *   Forçar `grid.ForceRefresh()`.

2.  **Lógica de Menu de Contexto (Targeted Delete):**
    *   Ajustar `on_right_click` para capturar o `video_id` da linha clicada (mesmo que não esteja marcada no checkbox).
    *   **Ação "Excluir":** Exibir `wx.MessageDialog` de confirmação. Se "Sim", chamar `app_state.delete_videos([target_id])`.

---

### Passo 4: Expansão do Console de Governança

1.  **`ui/dialog_config.py`:**
    *   Adicionar aba **"Extração & Segurança"**.
    *   **Campos Mandatórios:**
        *   Slider para `Tempo de Cooldown (min)`.
        *   SpinCtrl para `Limite de Erros 429`.
        *   Checkbox para `Usar Cookies` e `Rotação de Proxies`.
        *   TextCtrl para `Ordem de Idiomas de Legenda` (ex: "pt,pt-BR,en").

---

### ✅ Definição de Concluído (DoD)

- [ ] O sistema de **Undo/Snackbar** for 100% removido do código e da interface.
- [ ] Uma exclusão feita pelo menu de contexto da Aba 2 remover o item **instantaneamente** da Aba 1 e da Sidebar.
- [ ] O atalho de **Espaço** marcar corretamente todos os vídeos selecionados em azul em ambas as abas operacionais.
- [ ] O arquivo `credentials.json` persistir as novas configurações de defesa e legendas com sucesso.
