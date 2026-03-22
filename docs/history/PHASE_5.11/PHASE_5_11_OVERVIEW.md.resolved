# PHASE 5.11: Sincronia Global e Refinamento de Interatividade

> **Status:** SSoT (Fonte Única de Verdade)
> **Foco:** Sincronização Cross-Tab, Seleção em Massa e Expurgo do Modo Undo
> **Referências:** Auditoria 5.10 e Feedback de Usabilidade

## 1. Contexto e Visão Geral
A Fase 5.11 redefine como o ContextFlow lida com a mutação de dados. Identificou-se que a exclusão de itens não refletia instantaneamente em todas as telas e que a lógica de "Undo" (Snackbar) introduzia complexidade desnecessária. Esta fase restaura a segurança dos diálogos de confirmação e implementa uma sincronia atômica via PubSub, garantindo que Aba 1, Aba 2 e Sidebar operem como um único organismo.

## 2. Pilares de Implementação

### 2.1. Exclusão de Alta Precisão
* **Fim do Undo:** Remoção total da lixeira temporária e do timer de deleção.
* **Menu de Contexto Soberano:** O clique direito para excluir deve ignorar o estado do checkbox e agir sobre o item focado pelo cursor da grade.
* **Confirmação Obrigatória:** Retorno do diálogo `wx.YES_NO` para evitar exclusões acidentais, conforme o perfil do Analista Solo.

### 2.2. Sincronia Global de Telas
* **Broadcasting de Mutação:** O evento `VIDEOS_DELETED` deve ser ouvido obrigatoriamente por todos os componentes de UI (Aba 1, Aba 2 e Sidebar) para disparar o `ForceRefresh()` ou reconstrução de árvores instantaneamente.
* **Integridade de Estado:** Garantia de que a remoção de um vídeo limpe o snapshot cache no `AppState` para evitar "itens fantasmas" na grade virtual.

### 2.3. Inteligência de Seleção (Blue-to-Check)
* **Atalho de Espaço:** Implementação de lógica para que, ao selecionar múltiplas linhas (destaque azul) e pressionar a tecla `Espaço`, todos os checkboxes correspondentes sejam marcados ou desmarcados simultaneamente.
* **Consistência Cross-Tab:** Este comportamento deve ser idêntico tanto na Doca de Carga (Aba 1) quanto no Cockpit Analítico (Aba 2).

## 3. Metas de Sucesso
* Atualização de 100% das telas em < 100ms após qualquer exclusão.
* Redução do número de cliques para marcação em massa de 50 para 1 (via espaço).
* Zero inconsistências visuais entre a Sidebar e as Grades Virtuais.
