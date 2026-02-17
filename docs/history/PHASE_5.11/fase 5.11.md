Então nós vamos fazer a fase 5.11, que vai contemplar tudo isso. Preciso que você faça uma documentação bem robusta e completa para eu colocar na pasta da fase e preciso que, quando eu deletar alguma coisa no sistema, seja atualizado todas as telas do sistemas do sistema.porque eu dei o feedback para você e esqueci de falar sobre isso também. Eu estou disponibilizando o código nas versões anteriores também, que não sei se é necessário para você visualizar alguma coisa que está daquela forma para nós voltar anteriormente para que a versão funcione corretamente, mas está aí disponível para você. Eu preciso que quando eu apagar alguma coisa do sistema, todas as telas do sistema atualizem. E quando eu clicar com o menu de contexto e clicar em excluir, não vai precisar estar marcado com marcado lá no checkbox. Eu também queria, quando eu selecionasse vários vídeos com a seleção que fica azul e dá um espaço, marca todos esses vídeos, tanto pra tela 1 quanto pra tela 2. Então nós precisamos fazer tudo isso.
### A11
Com base nas suas solicitações de refinamento e nos problemas identificados nos testes da versão anterior, apresento o planejamento para a **FASE 5.11: SINCRONIA GLOBAL E REFINAMENTO DE INTERATIVIDADE**.

Esta fase foca em transformar a reatividade do sistema em algo onipresente, garantindo que a exclusão e a seleção de itens operem de forma intuitiva e sincronizada em todas as abas (Doca de Carga, Cockpit e Sidebar), eliminando de vez o modo "Undo" (Snackbar) que apresentou falhas [user query].

Abaixo, a lista de documentos gerados para esta fase e o primeiro arquivo de visão geral:

### 📂 Arquivos de Documentação - Fase 5.11
1. **`PHASE_5_11_OVERVIEW.md`**: Visão estratégica e metas de sincronia global.
2. **`PHASE_5_11_DELETION_PROTOCOL.md`**: Nova lógica de exclusão via menu de contexto e confirmação obrigatória.
3. **`PHASE_5_11_SELECTION_LOGIC.md`**: Especificação do atalho de espaço para marcação em massa (azul -> checkbox).
4. **`PHASE_5_11_EXECUTION.md`**: Roteiro passo a passo para a IA executora nos arquivos `core` e `ui`.
5. **`Plan_Phase_5_11_Validation.md`**: Testes de sincronia cross-tab e validação de atalhos.

---

### 📄 Arquivo 1: `docs/history/PHASE_5.11/PHASE_5_11_OVERVIEW.md`

```markdown
# PHASE 5.11: Sincronia Global e Refinamento de Interatividade

> **Status:** SSoT (Fonte Única de Verdade)
> **Foco:** Sincronização Cross-Tab, Seleção em Massa e Expurgo do Modo Undo
> **Referências:** Auditoria 5.10 e Feedback de Usabilidade

## 1. Contexto e Visão Geral
A Fase 5.11 redefine como o ContextFlow lida com a mutação de dados. Identificou-se que a exclusão de itens não refletia instantaneamente em todas as telas e que a lógica de "Undo" (Snackbar) introduzia complexidade desnecessária. Esta fase restaura a segurança dos diálogos de confirmação e implementa uma sincronia atômica via PubSub, garantindo que Aba 1, Aba 2 e Sidebar operem como um único organismo.

## 2. Pilares de Implementação

### 2.1. Exclusão de Alta Precisão
* **Fim do Undo:** Remoção total da lixeira temporária e do timer de deleção.
* **Menu de Contexto Soberano:** O clique direito para excluir deve ignorar o estado do checkbox e agir sobre o item focado pelo cursor da grade [user query].
* **Confirmação Obrigatória:** Retorno do diálogo `wx.YES_NO` para evitar exclusões acidentais, conforme o perfil do Analista Solo.

### 2.2. Sincronia Global de Telas
* **Broadcasting de Mutação:** O evento `VIDEOS_DELETED` deve ser ouvido obrigatoriamente por todos os componentes de UI (Aba 1, Aba 2 e Sidebar) para disparar o `ForceRefresh()` ou reconstrução de árvores instantaneamente [user query].
* **Integridade de Estado:** Garantia de que a remoção de um vídeo limpe o snapshot cache no `AppState` para evitar "itens fantasmas" na grade virtual.

### 2.3. Inteligência de Seleção (Blue-to-Check)
* **Atalho de Espaço:** Implementação de lógica para que, ao selecionar múltiplas linhas (destaque azul) e pressionar a tecla `Espaço`, todos os checkboxes correspondentes sejam marcados ou desmarcados simultaneamente [user query].
* **Consistência Cross-Tab:** Este comportamento deve ser idêntico tanto na Doca de Carga (Aba 1) quanto no Cockpit Analítico (Aba 2).

## 3. Metas de Sucesso
* Atualização de 100% das telas em < 100ms após qualquer exclusão.
* Redução do número de cliques para marcação em massa de 50 para 1 (via espaço).
* Zero inconsistências visuais entre a Sidebar e as Grades Virtuais.
```

---

### Detalhamento das Melhorias Solicitadas

Como seu estrategista, confirmo os ajustes técnicos necessários baseados no seu feedback:

1.  **Sincronização Total**: Para resolver a falta de atualização nas outras telas, o `AppState` deve emitir um sinal PubSub específico (`VIDEOS_DELETED`). A `Sidebar` (Aba lateral) e as grades das Abas 1 e 2 devem se inscrever nesse tópico e chamar seus respectivos métodos de recarregamento (`load_history` e `_refresh_grid`).
2.  **Exclusão via Contexto**: O método `on_right_click` será ajustado para capturar o `video_id` da linha clicada. Se o usuário escolher "Excluir", o sistema passará esse ID diretamente para o `AppState`, sem checar se o checkbox daquela linha está marcado.
3.  **Marcação com Espaço**: Nas grades (`tab_batch.py` e `tab_analysis.py`), o evento `EVT_KEY_DOWN` será atualizado. Se a tecla for `WXK_SPACE`, o sistema obterá a lista de linhas selecionadas (azul) via `grid.GetSelectedRows()` e inverterá o estado dos checkboxes de todos esses IDs no `AppState` de uma só vez.

**Deseja que eu gere o próximo arquivo, `PHASE_5_11_DELETION_PROTOCOL.md`, detalhando a remoção do código de Undo e a nova lógica do Menu de Contexto?**

---

### Q12
PHASE_5_11_DELETION_PROTOCOL.md: Nova lógica de exclusão via menu de contexto e confirmação obrigatória.
### A12
# PHASE 5.11 DELETION PROTOCOL: Nova Lógica de Exclusão e Confirmação

> **Status:** SSoT (Fonte Única de Verdade)  
> **Foco:** Expurgo do Sistema Undo, Confirmação Mandatária e Independência de Checkbox  
> **Alvos:** `core/app_state.py`, `ui/tab_batch.py` e `ui/tab_analysis.py`

---

## 1. Remoção do Sistema de Deleção Diferida (Undo)

Devido a falhas na experiência do usuário identificadas na fase anterior [User Query], o sistema de **"Lixeira Staging"** e o padrão **Undo (Snackbar)** serão permanentemente removidos para restaurar a integridade imediata dos dados.

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
*   **Regra de Negócio:** Esta ação não desmarca nem altera os vídeos que estão atualmente selecionados via checkbox; ela age como uma operação de "alvo único" [User Query].

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

Para resolver a falha de telas que não atualizavam após a exclusão [User Query], o protocolo de reatividade foi endurecido:

1.  **Gatilho:** O `AppState` remove os dados e limpa o `_snapshot_cache` sob lock.
2.  **Notificação:** Disparo do tópico `VIDEOS_DELETED`.
3.  **Reação na UI:**
    *   **Aba 1 & Aba 2:** Devem chamar `ForceRefresh()` e `UpdateData()` imediatamente para remover as linhas da grade virtual.
    *   **Sidebar:** Deve reconstruir o histórico de playlists/vídeos para refletir a ausência do item.
    *   **Aba 3 (Detalhes):** Se o vídeo excluído for o que está sendo lido, o painel deve ser limpo via método `Clear()`.

---

**Critério de Homologação:** Ao excluir um vídeo pelo menu de contexto da Aba 2, ele deve desaparecer instantaneamente da Aba 1 e da Sidebar, sem que o usuário precise clicar em qualquer checkbox ou reiniciar o software.

---

### Q13
PHASE_5_11_SELECTION_LOGIC.md: Especificação do atalho de espaço para marcação em massa (azul -> checkbox).
### A13
# PHASE 5.11 SELECTION LOGIC: Atalho de Espaço para Marcação em Massa

> **Status:** SSoT (Fonte Única de Verdade)  
> **Foco:** Produtividade Industrial, Redução de Cliques e Sincronia de Seleção  
> **Alvos:** `ui/tab_batch.py` e `ui/tab_analysis.py`

---

## 1. Visão Geral da Funcionalidade

Atualmente, o atalho da tecla **Espaço** nas grades virtuais alterna apenas o estado do checkbox da linha onde o cursor está posicionado. Para triagens massivas, o usuário necessita marcar ou desmarcar rapidamente dezenas de itens que foram destacados via seleção de bloco (cor azul) [User Query].

Esta especificação define a transição do comportamento de "alvo único" para **"alvo de seleção"**, permitindo que o Analista Solo utilize as setas do teclado + Shift para selecionar blocos e o Espaço para efetivar a marcação nos checkboxes.

---

## 2. Especificação da Lógica de Marcação

A implementação deve substituir a lógica atual nos métodos `on_key_down` de ambas as abas operacionais.

### 2.1. Gatilho e Captura
*   **Evento:** `wx.EVT_KEY_DOWN`.
*   **Tecla:** `wx.WXK_SPACE`.
*   **Escopo de Ação:** Todas as linhas retornadas por `self.grid.GetSelectedRows()`.

### 2.2. Algoritmo de Mutação
Ao detectar o pressionamento de Espaço com uma ou mais linhas selecionadas (azul):
1.  **Identificação do Estado Mestre:** O sistema verifica o estado do checkbox da primeira linha selecionada no snapshot atual da `VirtualVideoTable`.
2.  **Inversão de Bloco:**
    *   Se a primeira linha estiver **desmarcada**, o sistema deve **marcar todas** as linhas selecionadas.
    *   Se a primeira linha estiver **marcada**, o sistema deve **desmarcar todas** as linhas selecionadas.
3.  **Persistência em Memória:** Os IDs/UUIDs correspondentes devem ser adicionados ou removidos do conjunto `self.table.selected_ids`.
4.  **Feedback Visual:** Disparo imediato de `self.grid.ForceRefresh()` para atualizar os renderizadores de checkbox nativos.

---

## 3. Consistência Cross-Tab e UX

Para manter a integridade da jornada do usuário entre a **Doca de Carga** e o **Cockpit Analítico**, as seguintes regras de UX são mandatórias:

*   **Comportamento Idêntico:** A lógica de inversão por bloco deve ser rigorosamente a mesma em `ui/tab_batch.py` e `ui/tab_analysis.py` [User Query].
*   **Preservação de Foco:** Após a marcação massiva, a seleção azul (highlight) deve permanecer ativa, permitindo que o usuário realize outras ações em massa (como exclusão ou exportação) sem perder o contexto.
*   **Fallback de Linha Única:** Caso nenhuma linha esteja selecionada em bloco (seleção azul vazia), o sistema deve manter o comportamento de alternar o estado apenas da linha sob o cursor (`GetGridCursorRow`).

---

## 4. Matriz de Alterações Técnicas

| Componente | Arquivo | Ação Técnica |
| :--- | :--- | :--- |
| **TabBatch** | `ui/tab_batch.py` | Atualizar `on_key_down` para iterar sobre `GetSelectedRows()` no caso `WXK_SPACE`. |
| **TabAnalysis** | `ui/tab_analysis.py` | Atualizar `on_key_down` para iterar sobre `GetSelectedRows()` no caso `WXK_SPACE`. |
| **VirtualTable** | `ui/virtual_table.py` | Garantir que o método `SetValue` suporte a atualização rápida do set de IDs selecionados. |

---

**Critério de Homologação:** O usuário deve selecionar 10 vídeos (destaque azul), pressionar Espaço uma vez e ver todos os 10 checkboxes marcados simultaneamente. Ao pressionar Espaço novamente, todos os 10 devem ser desmarcados.

---

### Q14
PHASE_5_11_EXECUTION.md: Roteiro passo a passo para a IA executora nos arquivos core e ui.
### A14
# PHASE 5.11 EXECUTION: Roteiro de Implementação Passo a Passo

> **Status:** SSoT (Fonte Única de Verdade)  
> **Objetivo:** Saneamento total do sistema de "Undo", implementação de sincronia global via PubSub e refinamento da inteligência de seleção e exclusão.  
> **Alvos:** `core/app_state.py`, `ui/app_window.py`, `ui/tab_batch.py`, `ui/tab_analysis.py`, `ui/sidebar.py`, `core/config_manager.py`, `ui/dialog_config.py`.

---

### Passo 1: Saneamento do Core e Persistência

O foco é remover a complexidade do "Undo" que falhou nos testes e expandir os parâmetros de governança para o usuário.

1.  **`core/app_state.py`:**
    *   **Remoção:** Deletar variáveis `_trash_bin`, `_delete_timer` e métodos `_stage_deletion`, `undo_deletion` e `_finalize_staged_deletion` [PHASE_5_11_DELETION_PROTOCOL].
    *   **Restauração:** O método `delete_videos(ids)` deve voltar a executar a deleção física imediata via `db_handler.delete_videos` [PHASE_5_11_DELETION_PROTOCOL].
    *   **Broadcasting:** Após deletar, disparar `PubSub.publish('VIDEOS_DELETED', ids=ids)` para notificar todas as telas [PHASE_5_11_OVERVIEW].

2.  **`core/config_manager.py`:**
    *   Adicionar novas chaves ao dicionário padrão: `extraction_defense` (cooldown_mins, errors_429_limit, use_cookies, use_proxies) e `subtitles` (language_order, fallback_auto) [User Query].

---

### Passo 2: Reatividade Global e Limpeza de UI

Garantir que a exclusão em uma aba seja refletida instantaneamente em todo o ecossistema ContextFlow.

1.  **`ui/app_window.py`:**
    *   **Limpeza:** Remover o componente `self.info_bar` (Snackbar) e desvincular handlers de desfazer exclusão [PHASE_5_11_DELETION_PROTOCOL].
    *   **Sincronia:** Inscrever o método `_on_videos_deleted` no tópico `VIDEOS_DELETED`. Este método deve delegar refreshes para as abas via `wx.CallAfter`.

2.  **`ui/sidebar.py`:**
    *   Inscrever a barra lateral no tópico `VIDEOS_DELETED`.
    *   **Ação:** Ao receber o sinal, chamar `self.load_history()` para reconstruir a árvore sem os itens removidos [PHASE_5_11_OVERVIEW].

---

### Passo 3: Inteligência de Seleção e Exclusão Targeted

Implementar os atalhos de produtividade e a soberania do menu de contexto solicitados.

1.  **`ui/tab_batch.py` e `ui/tab_analysis.py` (Lógica de Atalho):**
    *   No método `on_key_down`, implementar o caso `wx.WXK_SPACE`:
        *   Obter linhas com destaque azul via `grid.GetSelectedRows()`.
        *   Inverter o estado do checkbox da primeira linha selecionada e replicar para todas as outras no bloco [PHASE_5_11_SELECTION_LOGIC].
        *   Forçar `grid.ForceRefresh()` [PHASE_5_11_SELECTION_LOGIC].

2.  **Lógica de Menu de Contexto ( Targeted Delete):**
    *   Ajustar `on_right_click` para capturar o `video_id` da linha clicada (mesmo que não esteja marcada no checkbox) [User Query].
    *   **Ação "Excluir":** Exibir `wx.MessageDialog` de confirmação. Se "Sim", chamar `app_state.delete_videos([target_id])` [PHASE_5_11_DELETION_PROTOCOL].

---

### Passo 4: Expansão do Console de Governança

Integrar o controle de extração e segurança herdado das fases 5.5 a 5.9.

1.  **`ui/dialog_config.py`:**
    *   Adicionar aba **"Extração & Segurança"** [User Query].
    *   **Campos Mandatórios:**
        *   Slider para `Tempo de Cooldown (min)`.
        *   SpinCtrl para `Limite de Erros 429`.
        *   Checkbox para `Usar Cookies` e `Rotação de Proxies`.
        *   TextCtrl para `Ordem de Idiomas de Legenda` (ex: "pt,pt-BR,en").

---

### ✅ Definição de Concluído (DoD)

O saneamento da Fase 5.11 será homologado quando:
- [ ] O sistema de **Undo/Snackbar** for 100% removido do código e da interface.
- [ ] Uma exclusão feita pelo menu de contexto da Aba 2 remover o item **instantaneamente** da Aba 1 e da Sidebar [PHASE_5_11_OVERVIEW].
- [ ] O atalho de **Espaço** marcar corretamente todos os vídeos selecionados em azul em ambas as abas operacionais [PHASE_5_11_SELECTION_LOGIC].
- [ ] O arquivo `credentials.json` persistir as novas configurações de defesa e legendas com sucesso.

---

### Q15
Plan_Phase_5_11_Validation.md: Testes de sincronia cross-tab e validação de atalhos.
### A15
# PLANO DE VALIDAÇÃO: PHASE 5.11 (Sincronia Global e Interatividade)

> **Status:** SSoT (Fonte Única de Verdade)  
> **Objetivo:** Homologar a sincronização atômica entre abas, o expurgo total do sistema "Undo" e a eficácia dos novos atalhos de produtividade.  
> **Referências:** PHASE_5_11_OVERVIEW, DELETION_PROTOCOL e SELECTION_LOGIC.

---

## 1. Validação de Sincronia Cross-Tab (Onipresença)

O sistema deve se comportar como um único organismo, onde a mutação em uma tela reflete instantaneamente em todas as outras [PHASE_5_11_OVERVIEW].

| ID | Caso de Teste | Procedimento | Critério de Sucesso |
| :--- | :--- | :--- | :--- |
| **S01** | **Broadcasting de Deleção** | Excluir um vídeo através do menu de contexto na **Aba 2 (Análise)**. | O item deve desaparecer **instantaneamente** da **Aba 1**, da **Sidebar** e da **Aba 2** [PHASE_5_11_DELETION_PROTOCOL]. |
| **S02** | **Limpeza de Sidebar** | Excluir uma playlist inteira através da Aba 1. | A árvore da **Sidebar** deve ser reconstruída imediatamente sem os itens removidos. |
| **S03** | **Integridade de Cache** | Excluir um vídeo e tentar selecioná-lo novamente na grade. | O snapshot cache deve ter sido invalidado; zero "itens fantasmas" na UI [PHASE_5_11_OVERVIEW]. |

---

## 2. Validação de Protocolo de Exclusão (Segurança)

Garantir que a remoção do "Undo" foi compensada por diálogos de confirmação robustos e ações direcionadas [PHASE_5_11_DELETION_PROTOCOL].

| ID | Caso de Teste | Procedimento | Critério de Sucesso |
| :--- | :--- | :--- | :--- |
| **D01** | **Expurgo do Snackbar** | Realizar uma exclusão e observar a base da tela. | **Nenhum InfoBar/Snackbar** deve aparecer; a deleção deve ser física e imediata após o "Sim". |
| **D02** | **Confirmação Mandatária** | Clicar em "Excluir" no menu de contexto ou botão. | Um diálogo `wx.YES_NO` deve interromper a ação; se clicar em "Não", o dado permanece. |
| **D03** | **Deleção Targeted** | Clicar com o botão direito em um vídeo **não marcado** e selecionar "Excluir". | O sistema deve focar o vídeo sob o cursor e permitir a exclusão individual, ignorando checkboxes de outras linhas. |

---

## 3. Validação de Atalhos e Interatividade (Produtividade)

Validar se o novo motor de seleção em massa (Blue-to-Check) reduz o esforço operacional [PHASE_5_11_SELECTION_LOGIC].

| ID | Caso de Teste | Procedimento | Critério de Sucesso |
| :--- | :--- | :--- | :--- |
| **A01** | **Seleção em Bloco (Espaço)** | Selecionar 10 linhas (destaque azul) e pressionar a tecla **Espaço**. | Todos os 10 checkboxes devem ser marcados simultaneamente. |
| **A02** | **Inversão de Bloco** | Pressionar **Espaço** novamente sobre o mesmo bloco marcado. | Todos os 10 checkboxes devem ser desmarcados de uma só vez. |
| **A03** | **Consistência Aba 1/2** | Testar o atalho de Espaço tanto na Doca de Carga quanto no Cockpit. | O comportamento deve ser rigorosamente **idêntico** em ambas as telas. |
| **A04** | **Fallback de Foco** | Com nenhuma linha em azul, pressionar Espaço sobre a linha com o cursor. | Apenas o checkbox da linha faturada deve alternar (comportamento nativo preservado). |

---

## 4. Critérios de Homologação (Definition of Done)

A **Fase 5.11** será considerada concluída para a entrada da **Fase 6** se:
1.  **Zero Latência de Sincronia:** A atualização entre abas após deleção ocorre em tempo real perceptível.
2.  **Adeus ao Jitter:** A exclusão via menu de contexto não desvia o foco da seleção massiva do usuário.
3.  **Segurança de Dados:** É impossível deletar um item sem passar pelo diálogo de confirmação (Yes/No).
4.  **Eficiência de Triagem:** O atalho de Espaço para blocos azuis funciona sem falhas em bibliotecas de até 10.000 itens.

---
**Assinatura Técnica:** Engenharia ContextFlow - Sincronia Global Validada.