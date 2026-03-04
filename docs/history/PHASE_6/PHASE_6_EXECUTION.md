# 6️⃣ PHASE_6_EXECUTION.md: Blindagem Estrutural (Muro de Arrimo)

**Função:** Manual Determinístico de Refatoração e Governança.
**Objetivo:** Transição do Monolito Singleton para Fachada com Delegação e Estabilização de UI/UX.
**Status:** **Mandatório - Nenhuma lógica de IA ou API deve ser implementada nesta fase.**

---

## 🏗️ 1. Roteiro de Implementação (5 Passos de Engenharia)

### Passo 1: Fundação Core (Gerentes Especializados)

* **Ação:** Criar diretório `core/managers/` e implementar classes de responsabilidade única.
* **Classes Obrigatórias:**
* `VideoManager`: CRUD e estado da lista de vídeos (extraído do `app_state.py`).
* `FinanceManager`: Cálculo de tokens (estático/placeholder) e controle de custos simulados.
* `TaskManager`: Orquestrador de threads com suporte a `StopIteration` e Kill-Switch.
* `ThemeManager`: Singleton de estilo forçando **Light Mode Absoluto** (Background: `#FFFFFF`, Texto: `#000000`).


* **Invariante:** O `ThemeManager` deve sobrescrever qualquer configuração de cores hardcoded nos componentes de UI.

### Passo 2: Refatoração da Fachada (AppState Leve)

* **Ação:** Esvaziar o corpo dos métodos lógicos em `core/app_state.py`.
* **Implementação:** Transformar `AppState` em uma **Fachada de Delegação**.
* *Exemplo:* `self.get_videos()` deve retornar `self.video_manager.get_all()`.


* **Retrocompatibilidade:** É proibido alterar as assinaturas (nomes de métodos e parâmetros) para não quebrar os eventos de UI existentes.

### Passo 3: Saneamento de Layout Grid (VirtualVideoTable)

* **Arquivo:** `ui/components/virtual_grid.py`.
* **Ação:** Atualizar o método `GetAttr` para padronização visual.
* **Regra de Alinhamento:**
* Se `column_name == 'Título'`: Manter `wx.ALIGN_LEFT`.
* Para todas as outras colunas: Aplicar obrigatoriamente `attr.SetAlignment(wx.ALIGN_CENTER, wx.ALIGN_CENTER)`.


* **Visual:** Definir `attr.SetBackgroundColour("#FFFFFF")` para garantir a integridade do Light Mode na grade.

### Passo 4: Interatividade Analítica (Cockpit Expandido)

* **Arquivo:** `ui/tabs/analysis_tab.py`.
* **Ação:** Vincular o evento `wx.grid.EVT_GRID_CELL_LEFT_DCLICK`.
* **Lógica:**
* Ao disparar o clique duplo, o `wx.SplitterWindow` deve ajustar a posição do `Sash` para expandir a área de detalhes (Cockpit).
* Implementar verificação `if self.user_mode == "PRO"` para permitir a expansão máxima.


* **Placeholder:** Os botões de "Gerar Resumo" devem exibir um `wx.MessageDialog` informativo: *"Módulo de IA em fase de homologação estrutural"*.

### Passo 5: Governança de Hardware (Semaforização Ollama)

* **Arquivo:** `core/managers/task_manager.py`.
* **Ação:** Implementar `ThreadPoolExecutor` com controle rígido de concorrência.
* **Configuração:** * `max_workers=1` para tarefas vinculadas ao provedor 'Ollama'.
* Filas de prioridade para garantir que o download não concorra com a futura thread de IA.


* **Proteção:** O sistema deve impedir o disparo de uma segunda tarefa local se uma já estiver em `RUNNING`.

---

## 💻 2. Pseudocódigo Crítico: TaskManager & Kill-Switch

```python
class TaskManager:
    def __init__(self):
        self._executor = ThreadPoolExecutor(max_workers=1) # Proteção de Hardware
        self._active_tasks = {}
        self._kill_event = threading.Event()

    def submit_task(self, task_id, func, *args):
        if self._kill_event.is_set():
            return False
        
        future = self._executor.submit(self._wrap_task, task_id, func, *args)
        self._active_tasks[task_id] = future
        return True

    def _wrap_task(self, task_id, func, *args):
        try:
            if not self._kill_event.is_set():
                return func(*args)
        finally:
            self._active_tasks.pop(task_id, None)

    def atomic_kill_switch(self):
        """Cancela todas as operações pendentes e sinaliza parada imediata."""
        self._kill_event.set()
        for task_id, future in self._active_tasks.items():
            future.cancel()
        self._executor.shutdown(wait=False, cancel_futures=True)
        # Reset para permitir reinicialização futura
        self._kill_event.clear()
        self._executor = ThreadPoolExecutor(max_workers=1)

```

---

## ✅ 3. Critérios de Aceite (Gherkin)

**Cenário: Saneamento Cromático e Estético**

* **Dado** que o sistema foi iniciado
* **Quando** qualquer componente de UI solicitar cores de fundo
* **Então** o `ThemeManager` deve retornar `#FFFFFF`
* **E** a `VirtualVideoTable` deve exibir todas as colunas (exceto Título) centralizadas.

**Cenário: Expansão do Cockpit Analítico**

* **Dado** que o usuário está na `AnalysisTab` em Modo PRO
* **Quando** realizar um duplo clique em uma célula da grade
* **Então** o painel de detalhes (Splitter) deve expandir para ocupar 70% da área visível
* **E** nenhum erro de renderização deve ocorrer no redimensionamento.

---

## ⚠️ 4. Declaração de Invariantes de Fase

1. **Isolamento de IA:** É terminantemente proibido importar `ollama` ou `google.generativeai` nesta sub-fase.
2. **Placeholders:** Botões de ação de IA devem estar em estado `Enabled(True)`, mas suas funções devem ser apenas logs ou diálogos estáticos.
3. **Muro de Arrimo:** O sucesso desta fase é definido pela capacidade do sistema de rodar sem o Singleton monolítico, mantendo a UI funcional.

---

**Protocolo de Verificação:**

* [ ] Executar `python -m pytest tests/test_facade_delegation.py`
* [ ] Validar visualmente a centralização da grade (Align Center).
* [ ] Testar Kill-Switch via console de debug durante simulado de tarefa.