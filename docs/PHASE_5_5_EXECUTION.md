# PHASE 5.5 EXECUTION: OPERAÇÃO "MONOLITO ZERO"

> **Status:** PLANEJADO & REVISADO
> **Objetivo:** Reconstrução Controlada de `panel_grid.py` e `processor.py`.
> **Regra de Ouro:** NENHUMA NOVA FEATURE. Apenas reconstrução.

## 1. OBJETIVO TÉCNICO FECHADO
Ao final desta fase, o sistema deve:
1.  Ter **exportação funcionando** mesmo que a UI da Grid quebre (Isolamento de Falha).
2.  Ter **Grid Virtualizada** consumindo dados do `AppState` sem duplicar estado na View.
3.  Não ter **nenhum import de `wx`** dentro de `core/processor.py` (Isolamento de Camada).

**Critério de Encerramento (Definition of Done):**
- [ ] `services/export_service.py` isolado e testado.
- [ ] `core/processor.py` livre de `wx` e usando PubSub.
- [ ] `ui/panel_grid.py` < 200 linhas.
- [ ] `ui/virtual_table.py` gerenciando exibição.
- [ ] **Teste de Stress:** Scroll com 5.000 itens a 60fps.
- [ ] **Teste de Regressão:** Exportação de ZIP idêntica à versão anterior.

**Critério de Abortar (Rollback Imediato):**
*   Se a exportação corromper dados (ZIP inválido).
*   Se a latência de clique na Grid > 200ms (regressão de UX).
*   Se o `AppState` demorar > 100ms para fornecer snapshot (gargalo de cópia).
*   **Ponto Sem Retorno:** Após o commit "FEAT: Grid Lobotomy" (Passo 3). Até ali, tudo deve ser reversível.

---

## 2. CONTRATOS E GARANTIAS
### 2.1. Contrato do PubSub (`core/pubsub.py`)
O sistema de mensagens deve obedecer estritamente a este contrato:
*   `TASK_QUEUED(uuid, url)`: Nova tarefa entrou na fila.
*   `TASK_STARTED(uuid)`: Processamento iniciou.
*   `METADATA_FETCHED(uuid, video_id, title)`: ID real descoberto.
*   `TASK_PROGRESS(video_id, status_msg)`: Feedback visual (ex: "Baixando 50%").
*   `TASK_COMPLETED(video_id, data_dict)`: Sucesso final.
*   `TASK_ERROR(video_id, error_msg)`: Falha.

### 2.2. Garantia do AppState
*   **Imutabilidade:** `get_all_videos()` deve retornar uma **cópia profunda** (ou segura) da lista para evitar *race conditions* durante iteração na UI.
*   **Performance:** A cópia de 5.000 itens deve ocorrer em < 50ms.
*   **Thread Safety:** Todo acesso de escrita protegido por `RLock`.

---

## 3. MAPEAMENTO DE DEMOLIÇÃO
### Alvo: `ui/panel_grid.py` (Monolito)
*   **Remover:** `row_map`, `row_ids` (Estado Duplicado), `run_export_thread` (Lógica), `processor` (Acoplamento).
*   **Manter:** Apenas setup de layout e handlers de eventos (`on_cell_click`).

### Alvo: `core/processor.py` (Core Comprometido)
*   **Remover:** `wx.CallAfter`, `export_batch`, imports de UI.
*   **Adicionar:** Chamadas `pubsub.publish()`.

---

## 4. SEQUÊNCIA DE EXECUÇÃO (Irreversível)

### PASSO 0: Teste de Regressão (Safety Net)
1.  **Criar** `tests/test_export_regression.py`.
2.  **Rodar** exportação atual de 5 vídeos.
3.  **Salvar** o ZIP gerado como "gold standard".
4.  O Passo 1 só é considerado sucesso se gerar um ZIP idêntico (conteúdo).

### PASSO 1: Excisão da Exportação (Service Extraction)
1.  **Criar** `services/export_service.py`.
2.  **Mover** lógica de `processor.export_batch`.
3.  **Refatorar** `panel_grid.py` para usar o novo serviço.
_Validação:_ Rodar `test_export_regression.py`.

### PASSO 2: Implementação da Virtual Table (Brain Transplant)
1.  **Criar** `ui/virtual_table.py`.
2.  Implementar `VirtualVideoTable` conectada ao `AppState`.
3.  **Teste de Performance Pure:** Script que pede 5.000 linhas ao `VirtualTable` e mede tempo. Se > 50ms, pare e otimize `AppState`.

### PASSO 3: Lobotomia da Grid (The Swap)
*Alerta: Ponto Sem Retorno*
1.  **Apagar** gestão manual de linhas no `panel_grid.py`.
2.  **Injetar** `VirtualVideoTable`.
3.  Ajustar handlers de clique para usar coordenadas virtuais.
_Validação:_ App abre e mostra dados. Scroll é fluido. Checkboxes funcionam.

### PASSO 4: Sistema Nervoso (PubSub)
1.  **Criar** `core/pubsub.py` com `wx.lib.pubsub` ou implementação leve.
2.  **Substituir** callbacks no `processor.py` por `publish`.
3.  **Conectar** `AppWindow` (ou `VirtualTable`) como subscriber.
_Validação:_ Adicionar URL. O status na grid deve mudar de "Pending" -> "Downloading" -> "Completed" sem erros de thread.

---

## 5. RISCOS E MITIGAÇÃO
*   **Estado Inconsistente (Visual vs Real):** Se o PubSub falhar, a Grid não atualiza.
    *   *Mitigação:* `VirtualTable` força refresh (`ForceRefresh`) em eventos críticos.
*   **Gargalo no AppState:** Se `get_all_videos` for lento, a UI congela.
    *   *Mitigação:* Medir tempo de cópia no Passo 2. Se necessário, implementar paginação no AppState (fase futura).

Execução aprovada.
