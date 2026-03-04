# PLANO DE VALIDAÇÃO: PHASE 5.11 (Sincronia Global e Interatividade)

> **Status:** SSoT (Fonte Única de Verdade)  
> **Objetivo:** Homologar a sincronização atômica entre abas, o expurgo total do sistema "Undo" e a eficácia dos novos atalhos de produtividade.  
> **Referências:** PHASE_5_11_OVERVIEW, DELETION_PROTOCOL e SELECTION_LOGIC.

---

## 1. Validação de Sincronia Cross-Tab (Onipresença)

| ID | Caso de Teste | Procedimento | Critério de Sucesso |
| :--- | :--- | :--- | :--- |
| **S01** | **Broadcasting de Deleção** | Excluir um vídeo através do menu de contexto na **Aba 2 (Análise)**. | O item deve desaparecer **instantaneamente** da **Aba 1**, da **Sidebar** e da **Aba 2**. |
| **S02** | **Limpeza de Sidebar** | Excluir uma playlist inteira através da Aba 1. | A árvore da **Sidebar** deve ser reconstruída imediatamente sem os itens removidos. |
| **S03** | **Integridade de Cache** | Excluir um vídeo e tentar selecioná-lo novamente na grade. | O snapshot cache deve ter sido invalidado; zero "itens fantasmas" na UI. |

---

## 2. Validação de Protocolo de Exclusão (Segurança)

| ID | Caso de Teste | Procedimento | Critério de Sucesso |
| :--- | :--- | :--- | :--- |
| **D01** | **Expurgo do Snackbar** | Realizar uma exclusão e observar a base da tela. | **Nenhum InfoBar/Snackbar** deve aparecer; a deleção deve ser física e imediata após o "Sim". |
| **D02** | **Confirmação Mandatária** | Clicar em "Excluir" no menu de contexto ou botão. | Um diálogo `wx.YES_NO` deve interromper a ação; se clicar em "Não", o dado permanece. |
| **D03** | **Deleção Targeted** | Clicar com o botão direito em um vídeo **não marcado** e selecionar "Excluir". | O sistema deve focar o vídeo sob o cursor e permitir a exclusão individual, ignorando checkboxes de outras linhas. |

---

## 3. Validação de Atalhos e Interatividade (Produtividade)

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
