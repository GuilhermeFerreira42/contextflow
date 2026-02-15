# PHASE 5.10 EXECUTION: Roteiro de Implementação Passo a Passo

> **Status:** SSoT (Fonte Única de Verdade)  
> **Objetivo:** Implementar a infraestrutura de governança, o motor de concorrência industrial e o polimento de UX conforme planejado.  
> **Alvos:** `core/processor.py`, `core/app_state.py`, `ui/app_window.py`, `ui/tab_batch.py`, `ui/virtual_table.py`

Este roteiro detalha a sequência lógica para transformar as especificações da Fase 5.10 em código funcional, garantindo estabilidade sistêmica e performance extrema.

---

### Passo 1: Estabilização do Motor e Estado (Industrial Core)

O foco inicial é o saneamento da concorrência para evitar travamentos de hardware e do banco de dados.

1.  **`core/app_state.py`:**
    *   Implementar a variável `_snapshot_cache` e o booleano `_cache_dirty`.
    *   Refatorar `get_unified_data` para utilizar o cache, reconstruindo-o apenas se `_cache_dirty` for verdadeiro **[PHASE_5_10_INDUSTRIAL_CORE]**.
    *   Garantir que todos os métodos de mutação (`add_video`, `delete_videos`, `promote_task`) ativem a flag de sujeira (`_cache_dirty = True`) sob lock **[PHASE_5_10_INDUSTRIAL_CORE]**.

2.  **`core/processor.py`:**
    *   Importar `concurrent.futures.ThreadPoolExecutor`.
    *   Substituir a criação manual de `threading.Thread` por submissões ao pool.
    *   Configurar o limite de workers dinamicamente com base no `credentials.json` (respeitando o teto de 1 worker para Ollama/Local) **[PHASE_5_10_INDUSTRIAL_CORE]**.

---

### Passo 2: Persistência e Gestão de Configurações

Centralização das chaves de API e preferências de interface em arquivo JSON transparente.

1.  **`core/config_manager.py` (NOVO):**
    *   Criar classe para ler e salvar o arquivo `config/credentials.json`.
    *   Implementar a estrutura de dicionário com seções: `api_keys`, `ollama`, `orchestration` e `ux_preferences` **[PHASE_5_10_CONFIG_SPECS]**.
    *   Garantir que as chaves sejam persistidas em texto puro, conforme requisito de simplicidade **[PHASE_5_10_OVERVIEW]**.

2.  **`ui/dialog_config.py` (NOVO):**
    *   Criar diálogo multi-aba (Notebook) para gestão visual destas configurações.
    *   Implementar mascaramento de chaves de API (`sk-••••`) após o input **[PHASE_5_10_CONFIG_SPECS]**.

---

### Passo 3: Refinamento de UX e Visibilidade

Transformar o feedback passivo em telemetria ativa.

1.  **`ui/tab_batch.py`:**
    *   Inserir o componente `wx.Gauge` logo abaixo do botão de processamento.
    *   Vincular o gauge aos eventos `TASK_QUEUED` e `METADATA_FETCHED` via PubSub para progresso determinado **[PHASE_5_10_UX_REFINEMENT]**.

2.  **`ui/panel_console.py`:**
    *   Refatorar o `WxLogHandler` para aplicar cores sintáticas: Vermelho (Erro), Laranja (Warning) e Azul (Info/System) no `RichTextCtrl` **[PHASE_5_10_UX_REFINEMENT]**.

3.  **`ui/app_window.py`:**
    *   Adicionar ícone de engrenagem (⚙️) na Toolbar superior para acesso rápido às configurações.
    *   Implementar o componente `wx.InfoBar` (Snackbar) para gerenciar a lógica de **Undo** em deleções massivas de 5 segundos **[PHASE_5_10_UX_REFINEMENT]**.

---

### Passo 4: Dinamismo de Interface (Estética SaaS)

Elevar a percepção de qualidade do produto através de microinterações.

1.  **`ui/virtual_table.py`:**
    *   Implementar la função `_get_tag_color(tag_name)` usando hash para gerar fundos coloridos consistentes **[PHASE_5_10_DYNAMIC_UI]**.
    *   Atualizar o `ChipTagRenderer` para aplicar estas cores dinâmicas com opacidade de 20% **[PHASE_5_10_DYNAMIC_UI]**.
    *   Implementar formatação de milhares com pontos na coluna de tokens (ex: `1.500.000`) **[PHASE_5_10_OVERVIEW]**.

2.  **`ui/tab_analysis.py`:**
    *   Adicionar botão de Toggle (Ícone de Raio/Olho) na toolbar para alternar entre o **Modo de Triagem Automático** e **Manual** (Smart Show) **[PHASE_5_10_DYNAMIC_UI]**.

---

### ✅ Definição de Concluílo (DoD)

O saneamento da Fase 5.10 será considerado homologado quando:
- [ ] Credenciais de Google, OpenAI e Grok forem salvas e carregadas com sucesso via JSON **[PHASE_5_10_CONFIG_SPECS]**.
- [ ] O processamento via Ollama não causar jitter na UI devido ao limite de 1 worker no pool **[PHASE_5_10_INDUSTRIAL_CORE]**.
- [ ] Erros técnicos forem identificados instantaneamente no console pela cor vermelha **[PHASE_5_10_UX_REFINEMENT]**.
- [ ] O scroll de 10.000 itens se mantiver estável em 60 FPS com tags coloridas dinamicamente **[PHASE_5_10_DYNAMIC_UI]**.
