# BLUEPRINT DE CORREÇÃO — FASE: FALHAS TÉCNICAS IMEDIATAS
**Destinatário:** IA Executora
**Referência:** Código-fonte anexado (a.pdf)
**Protocolo:** Bisturi, não Marreta — alterações cirúrgicas, sem refatoração de escopo

---

## PRÉ-LEITURA OBRIGATÓRIA

Antes de qualquer modificação, leia e internalize:
- `docs/CURRENT_STATE.md` — Invariantes Globais (especialmente nº 2 e nº 4)
- `core/pubsub.py` — O aviso crítico de thread já está documentado no código
- `core/processor.py` — Método `_process_task` completo
- `ui/app_window.py` — Seção `_bind_events` e handlers de PubSub
- `ui/tab_analysis.py` — Handlers `_on_summary_*` e `_on_summary_completed`

---

## FALHA 1 — DOWNLOADS REINICIANDO AO REABRIR O APP

### Diagnóstico Confirmado

**Arquivo principal:** `core/processor.py`
**Método afetado:** `_resume_interrupted_tasks` (linha ~linha 180 do processor.py)
**Causa raiz identificada no código:**

```python
# CÓDIGO ATUAL — O BUG ESTÁ AQUI:
interrupted = [v for v in all_videos if v.get('status') in ['processing', 'downloading', 'queued']]
```

O filtro **não exclui vídeos com `status == 'completed'`**, mas o problema real é duplo:

1. O método `_process_task` faz `promote_task_to_video` com `video_data['status'] = 'completed'`, mas a persistência no DB ocorre via `task_manager.submit_task` (assíncrono). Se o app fechar antes da escrita, o DB fica com `status = 'processing'`.

2. O `add_video_entry` no `db_handler.py` tem lógica COALESCE que pode **ignorar atualizações de status** em conflito.

---

### CORREÇÃO 1A — `core/processor.py`

**Localizar o método `_resume_interrupted_tasks`** e aplicar a seguinte correção:

```python
def _resume_interrupted_tasks(self):
    """
    [PHASE_5_12] Busca vídeos que ficaram 'presos' em processamento
    antes do desligamento e os devolve à fila.
    [FIX] Exclui explicitamente vídeos já concluídos no DB.
    """
    all_videos = self.app_state.get_all_videos()
    
    # [FIX CRÍTICO] Filtra APENAS status intermediários.
    # 'completed' e 'ERROR' NÃO devem ser retomados automaticamente.
    interrupted = [
        v for v in all_videos 
        if v.get('status') in ['processing', 'downloading', 'queued']
        and v.get('status') != 'completed'  # Guarda explícita redundante
    ]
    
    if not interrupted: return
    
    logger.info(f"Retomando {len(interrupted)} tarefas interrompidas...")
    for v in interrupted:
        task = ProcessingTask(
            url=v['url'],
            uuid=v.get('uuid') or str(uuid.uuid4()),
            playlist_id=v.get('playlist_id'),
            playlist_title=v.get('playlist_title'),
            title=v.get('title'),
            video_id=v['id']
        )
        self.app_state.update_video_status(v['id'], 'queued')
        self.task_queue.put(task)
```

**Observação:** O filtro atual já exclui `completed` implicitamente, mas o bug real está na CORREÇÃO 1B abaixo.

---

### CORREÇÃO 1B — `storage/db_handler.py` — CRÍTICA

**Localizar o método `add_video_entry`** e identificar a cláusula `ON CONFLICT DO UPDATE SET`:

```sql
-- CÓDIGO ATUAL COM BUG:
status=COALESCE(status, excluded.status),
```

**O problema:** `COALESCE(status, excluded.status)` mantém o valor existente se não for NULL. Como `status` nunca é NULL (tem DEFAULT 'pending'), o status **NUNCA é atualizado** por este caminho.

**Aplicar a seguinte correção cirúrgica:**

```python
# Localizar em add_video_entry, dentro do cursor.execute('''INSERT INTO videos...''')
# Substituir APENAS a linha do status no ON CONFLICT:

# DE:
# status=COALESCE(status, excluded.status),

# PARA:
# status=COALESCE(excluded.status, status),
```

**Explicação:** Inverter a ordem do COALESCE faz com que o novo valor (`excluded.status`) tenha prioridade. Se o novo valor for NULL (não fornecido), mantém o existente.

---

### CORREÇÃO 1C — `core/processor.py` — Persistência Síncrona no Término

**Localizar em `_process_task`** o bloco de promoção atômica (próximo ao final do método, antes do `PubSub.publish('TASK_COMPLETED'...)`):

```python
# CÓDIGO ATUAL:
video_data['status'] = 'completed'
video_data['token_count'] = token_count
self.app_state.promote_task_to_video(task.uuid, video_data)
```

**Adicionar persistência síncrona imediata APÓS a promoção:**

```python
# APÓS promote_task_to_video, adicionar:
video_data['status'] = 'completed'
video_data['token_count'] = token_count
self.app_state.promote_task_to_video(task.uuid, video_data)

# [FIX INVARIANTE Nº2] Persistência síncrona obrigatória antes de qualquer
# notificação de UI. Garante que o DB reflita 'completed' antes do próximo boot.
self.app_state.db_handler.update_video_status(
    task.video_id, 
    'completed', 
    token_count=token_count
)
logger.info(f"Task {task.uuid}: status 'completed' persistido sincronamente no DB.")
```

**Localizar também** o bloco de erro no `except Exception as e` dentro de `_process_task` e garantir que o status de erro também seja persistido sincronamente:

```python
# LOCALIZAR (já existe parcialmente):
if task.video_id:
    self.app_state.update_video_status(task.video_id, "ERROR")
    PubSub.publish('TASK_ERROR', video_id=task.video_id, error_msg=str(e))
    self.app_state.remove_active_task(task.uuid)

# ADICIONAR após update_video_status:
if task.video_id:
    self.app_state.update_video_status(task.video_id, "ERROR")
    # [FIX] Persistência síncrona do erro
    self.app_state.db_handler.update_video_status(task.video_id, "ERROR")
    PubSub.publish('TASK_ERROR', video_id=task.video_id, error_msg=str(e))
    self.app_state.remove_active_task(task.uuid)
```

---

## FALHA 2 — BARRA DE PROGRESSO INFINITA APÓS CONCLUSÃO

### Diagnóstico Confirmado

**Arquivo principal:** `ui/tab_analysis.py`
**Handlers afetados:** `_on_summary_completed` e `_on_summary_error`
**Arquivo secundário:** `ui/app_window.py`

**Causa raiz identificada no código atual de `tab_analysis.py`:**

```python
# CÓDIGO ATUAL — _on_summary_completed:
def _on_summary_completed(self, video_id, summary_preview="", tags=None, **kwargs):
    def _update():
        self._summary_in_progress.discard(video_id)
        self._refresh_grid()
        self._maybe_open_viewer(video_id)
    wx.CallAfter(_update)  # ✅ Correto — já usa CallAfter

# CÓDIGO ATUAL — _on_summary_error:
def _on_summary_error(self, video_id, error_msg="", **kwargs):
    def _update():
        self._summary_in_progress.discard(video_id)
        self._refresh_grid()
    wx.CallAfter(_update)  # ✅ Correto — já usa CallAfter
```

Os handlers da `TabAnalysis` já estão corretos. O problema está em **outro local**: o `gauge` da `TabBatch` e o indicador visual do `SummaryStatusRenderer` na grid.

**Investigação adicional — `ui/tab_batch.py`:**

```python
# O gauge é controlado por on_progress_signal:
PubSub.subscribe('METADATA_FETCHED', self.on_progress_signal)
PubSub.subscribe('TASK_COMPLETED', self.on_progress_signal)
PubSub.subscribe('TASK_ERROR', self.on_progress_signal)
PubSub.subscribe('TASKS_CLEARED', self.on_progress_signal)
PubSub.subscribe('ALL_TASKS_STOPPED', self.on_progress_signal)

# BUG: 'SUMMARY_COMPLETED' e 'SUMMARY_ERROR' NÃO estão subscritos aqui
# Se o usuário só faz resumos (sem downloads), o gauge nunca fecha.
```

---

### CORREÇÃO 2A — `ui/tab_batch.py` — Gauge não fecha para eventos de IA

**Localizar** o método `_bind_events` em `TabBatch`, na seção de PubSub:

```python
# CÓDIGO ATUAL:
PubSub.subscribe('METADATA_FETCHED', self.on_progress_signal)
PubSub.subscribe('TASK_COMPLETED', self.on_progress_signal)
PubSub.subscribe('TASK_ERROR', self.on_progress_signal)
PubSub.subscribe('TASKS_CLEARED', self.on_progress_signal)
PubSub.subscribe('ALL_TASKS_STOPPED', self.on_progress_signal)
```

**Adicionar as subscrições faltantes:**

```python
# ADICIONAR após as linhas existentes de PubSub.subscribe:
PubSub.subscribe('SUMMARY_COMPLETED', self.on_progress_signal)
PubSub.subscribe('SUMMARY_ERROR', self.on_progress_signal)
```

---

### CORREÇÃO 2B — `ui/tab_analysis.py` — Validação do wx.CallAfter nos handlers

**Auditar os três handlers de PubSub de IA.** O código atual já usa `wx.CallAfter`, mas verificar se o `_on_summary_started` também está correto:

```python
# CÓDIGO ATUAL — _on_summary_started:
def _on_summary_started(self, video_id, **kwargs):
    def _update():
        self._summary_in_progress.add(video_id)
        self._refresh_grid()
    wx.CallAfter(_update)  # ✅ Verificado — correto
```

**Se o código encontrado NÃO tiver `wx.CallAfter`**, aplicar o padrão:

```python
def _on_summary_started(self, video_id, **kwargs):
    """
    Handler para SUMMARY_STARTED.
    [THREAD SAFETY — REGRA FASE 6.1b] wx.CallAfter OBRIGATÓRIO.
    Este método é chamado da thread do AIExecutor, não da Main Thread.
    """
    def _update():
        self._summary_in_progress.add(video_id)
        self._refresh_grid()
    wx.CallAfter(_update)

def _on_summary_completed(self, video_id, summary_preview="", tags=None, **kwargs):
    """
    Handler para SUMMARY_COMPLETED.
    [THREAD SAFETY — REGRA FASE 6.1b] wx.CallAfter OBRIGATÓRIO.
    """
    def _update():
        self._summary_in_progress.discard(video_id)
        self._refresh_grid()
        self._maybe_open_viewer(video_id)
    wx.CallAfter(_update)

def _on_summary_error(self, video_id, error_msg="", **kwargs):
    """
    Handler para SUMMARY_ERROR.
    [THREAD SAFETY — REGRA FASE 6.1b] wx.CallAfter OBRIGATÓRIO.
    """
    def _update():
        self._summary_in_progress.discard(video_id)
        self._refresh_grid()
    wx.CallAfter(_update)
```

---

### CORREÇÃO 2C — `ui/app_window.py` — Handler global faltante

**Verificar** se `app_window.py` tem subscrição para `SUMMARY_COMPLETED` e `SUMMARY_ERROR`. **Localizar `_bind_events`:**

```python
# CÓDIGO ATUAL (verificar se existe):
PubSub.subscribe('TASK_PROGRESS', self.on_global_progress)
PubSub.subscribe('TASK_ERROR', self.on_global_error)
PubSub.subscribe('TASK_QUEUED', self.on_task_queued)
# ... outros
```

**Se não existirem handlers para eventos de IA, adicionar:**

```python
# Em _bind_events, ADICIONAR:
PubSub.subscribe('SUMMARY_COMPLETED', self._on_summary_completed_global)
PubSub.subscribe('SUMMARY_ERROR', self._on_summary_error_global)
```

**Adicionar os métodos handlers correspondentes na classe `AppWindow`:**

```python
def _on_summary_completed_global(self, video_id, **kwargs):
    """
    [THREAD SAFETY — REGRA FASE 6.1b] Handler global de conclusão de resumo.
    Atualiza a StatusBar para feedback do usuário.
    wx.CallAfter obrigatório — chamado da thread do AIExecutor.
    """
    wx.CallAfter(
        self.SetStatusText, 
        f"Resumo concluído: {video_id}", 
        0
    )

def _on_summary_error_global(self, video_id, error_msg="", **kwargs):
    """
    [THREAD SAFETY — REGRA FASE 6.1b] Handler global de erro de resumo.
    wx.CallAfter obrigatório — chamado da thread do AIExecutor.
    """
    wx.CallAfter(
        self.SetStatusText, 
        f"Erro no resumo de {video_id}: {error_msg[:50]}", 
        0
    )
    self.log_to_console(f"Erro de resumo em {video_id}: {error_msg}", "ERROR")
```

---

## SEQUÊNCIA DE EXECUÇÃO OBRIGATÓRIA

Execute as correções **nesta ordem exata**:

```
1. storage/db_handler.py         → CORREÇÃO 1B (COALESCE invertido)
2. core/processor.py             → CORREÇÃO 1A (_resume_interrupted_tasks)
3. core/processor.py             → CORREÇÃO 1C (persistência síncrona)
4. ui/tab_batch.py               → CORREÇÃO 2A (PubSub SUMMARY_*)
5. ui/tab_analysis.py            → CORREÇÃO 2B (validar wx.CallAfter)
6. ui/app_window.py              → CORREÇÃO 2C (handlers globais de IA)
```

---

## TESTES DE VALIDAÇÃO

Após aplicar todas as correções, executar manualmente:

### Teste 1 — Persistência de Downloads
```
1. Processar 2-3 URLs até conclusão
2. Fechar o app completamente (não apenas minimizar)
3. Reabrir o app
4. ESPERADO: Nenhum download reinicia. Vídeos aparecem com status 'completed'.
5. FALHA SE: Downloads iniciam novamente para vídeos já concluídos.
```

### Teste 2 — Barra de Progresso
```
1. Selecionar um vídeo com transcrição
2. Clicar "✨ Resumir Selecionados"
3. Aguardar conclusão do resumo
4. ESPERADO: O ícone na coluna Resumo muda de "⏳" para "✅". Gauge some.
5. FALHA SE: O ícone permanece em "⏳" após conclusão sem reiniciar a UI.
```

### Teste 3 — Regressão Thread Safety
```
1. Iniciar resumo de 3 vídeos simultaneamente
2. Observar o console de logs
3. ESPERADO: Sem erros "wx._core.PyAssertionError" ou crashes de UI
4. FALHA SE: Qualquer erro relacionado a "called from wrong thread"
```

---

## RESTRIÇÕES DE ESCOPO

```
❌ NÃO modificar: virtual_table.py (renderizadores funcionam corretamente)
❌ NÃO modificar: core/pubsub.py (arquitetura de pub/sub está correta)
❌ NÃO modificar: services/ai_executor.py (publicação de eventos está correta)
❌ NÃO refatorar: Qualquer método além dos especificados acima
✅ PODE adicionar: Apenas logging adicional para diagnóstico futuro
```

---

## INVARIANTES QUE ESTE FIX PRESERVA

| Invariante | Como preservada |
|---|---|
| **Nº 2** — Persistir antes de atualizar cache | CORREÇÃO 1C adiciona UPDATE síncrono antes do PubSub |
| **Nº 3** — Sem processamento pesado na Main Thread | Todas as correções de UI usam `wx.CallAfter` |
| **Nº 4** — Observers via `wx.CallAfter` | CORREÇÃO 2B garante o padrão em todos os handlers |