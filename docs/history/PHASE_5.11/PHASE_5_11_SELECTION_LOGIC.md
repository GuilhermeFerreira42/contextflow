# PHASE 5.11 SELECTION LOGIC: Atalho de Espaço para Marcação em Massa

> **Status:** SSoT (Fonte Única de Verdade)  
> **Foco:** Produtividade Industrial, Redução de Cliques e Sincronia de Seleção  
> **Alvos:** `ui/tab_batch.py` e `ui/tab_analysis.py`

---

## 1. Visão Geral da Funcionalidade

Atualmente, o atalho da tecla **Espaço** nas grades virtuais alterna apenas o estado do checkbox da linha onde o cursor está posicionado. Para triagens massivas, o usuário necessita marcar ou desmarcar rapidamente dezenas de itens que foram destacados via seleção de bloco (cor azul).

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

*   **Comportamento Idêntico:** A lógica de inversão por bloco deve ser rigorosamente a mesma em `ui/tab_batch.py` e `ui/tab_analysis.py`.
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
