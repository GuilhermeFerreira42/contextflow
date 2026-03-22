Com base na análise técnica comparativa entre o código funcional da Fase 5.6 e a estrutura segregada da Fase 5.8, identificamos que a transição para a grade virtual resultou em uma perda de fluidez na usabilidade, especialmente na manipulação de **checkboxes** e na navegação de **links**.

Para finalizar a **Fase 5.8 (Ajustes Finais da Doca de Carga)**, seguem os arquivos de documentação técnica que detalham a restauração da eficiência "clique-e-vá" na **Aba 1 (TabBatch)**.

---

### 1. PHASE_5_8_UI_FIXES.md: Correções de Usabilidade e Eventos

Este documento detalha a migração do estado textual para o **Checkbox Nativo** e a implementação de gatilhos de clique imediato.

*   **Restauração do Formato Booleano:** A coluna `[x]` (Índice 1) deve abandonar a exibição de caracteres "0" e "1". O motor da grade deve utilizar obrigatoriamente `SetColFormatBool(1)` no `GetAttr` da `VirtualVideoTable`, replicando o comportamento visual de sucesso da versão 5.6.
*   **Toggle Instantâneo (One-Click):** Na `TabBatch`, o vínculo ao evento `EVT_GRID_CELL_LEFT_CLICK` deve interceptar cliques na coluna 1. Se detectado, o sistema deve inverter o valor no conjunto `selected_ids` do `AppState` e disparar um `ForceRefresh` da célula sem invocar o modo de edição da grade.
*   **Seleção Global via Cabeçalho:** O clique no rótulo da coluna `[x]` (`EVT_GRID_LABEL_LEFT_CLICK`) deve atuar como um interruptor mestre. A lógica deve iterar sobre todos os itens carregados no snapshot atual da `VirtualVideoTable`, marcando ou desmarcando todos simultaneamente.
*   **Affordance de Navegação:** Para a coluna de **Link**, deve-se restaurar a mudança dinâmica do cursor para o formato de "mão" (`wx.CURSOR_HAND`) ao passar sobre a célula. O clique na célula deve invocar `webbrowser.open()` para o carregamento imediato do vídeo no navegador padrão do usuário.

---

### 2. PHASE_5_8_COLUMN_STABILITY.md: Definição SSoT de Colunas

Este arquivo estabelece a ordem final e imutável das colunas para a Aba 1, focando na produtividade técnica e eliminando redundâncias visuais.

*   **Saneamento de Dados:** A coluna de **Thumbnail (Miniatura)** será **removida** da Aba 1. Como esta aba é a "Doca de Carga" técnica, o foco deve ser a densidade de informações brutas e a velocidade de triagem.
*   **Restauração do Link (URL):** A coluna **Link** retorna à visualização ativa, posicionada no **Índice 2** da grade.
*   **Ordem Mandatária das 11 Colunas:**
    1.  **#** (Índice cronológico de adição).
    2.  **[x]** (Seleção nativa para ações em massa).
    3.  **Link** (URL funcional do vídeo).
    4.  **Título** (Extraído pelo Processor).
    5.  **Canal** (Nome do uploader/autor).
    6.  **Publicado** (Data de upload original).
    7.  **Adicionado** (Timestamp de entrada no ContextFlow).
    8.  **Playlist** (Título da coleção de origem).
    9.  **Duração** (Tempo formatado HH:MM:SS).
    10. **Tokens** (Contagem precisa da TokenEngine).
    11. **Status** (Estatísticas de processamento colorido).

---

### 3. Plan_Phase_5_8_Final_Validation.md: Roteiro de Testes de Usabilidade

Roteiro de validação para garantir a integridade da experiência "clique-e-vá" restaurada.

| Caso de Teste | Ação | Resultado Esperado |
| :--- | :--- | :--- |
| **U01: Checkbox Direto** | Clicar uma única vez no checkbox da coluna `[x]`. | O estado deve mudar visualmente e ser registrado no `AppState` sem abrir editor de texto. |
| **U02: Seleção Mestre** | Clicar no cabeçalho da coluna `[x]`. | Todas as linhas visíveis devem ser marcadas ou desmarcadas instantaneamente. |
| **U03: Acesso Web** | Clicar na URL da coluna **Link**. | O vídeo deve abrir no navegador padrão; cursor deve mudar para mão ao pairar sobre o link. |
| **U04: Triagem de Erro** | Provocar falha de rede para um item na fila. | A coluna **Status** deve mudar para cor **Vermelha (ERROR)**, permitindo identificação imediata na grade técnica. |
| **U05: Reativação PubSub** | Inserir 5 URLs e clicar em "Processar Fila". | O botão deve publicar em `REQUEST_BATCH_PROCESSING` e o `Processor` deve iniciar o enfileiramento sem atrasos. |

---

**Comando de Execução Sugerido:**
Estes documentos devem ser inseridos na pasta `docs/history/PHASE_5.8/`. A inteligência artificial executora deve agora aplicar as mudanças nos arquivos `ui/virtual_table.py` e `ui/tab_batch.py`, assegurando que a lógica de **Checkbox Nativo** e **Links Clicáveis** respeite o isolamento entre as abas.