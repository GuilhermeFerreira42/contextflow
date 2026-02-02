# PHASE 5.8 UI BEHAVIOR: Comportamento e Usabilidade da Doca de Carga

> **Status:** Fonte Única de Verdade (SSoT)
> **Assunto:** Restauração da Usabilidade "Clique-e-Vá" e Identidade Visual Técnica
> **Data:** 02 de Fevereiro de 2026

## 1. Restauração do Checkbox Nativo
A transição para a grade virtual havia descaracterizado a seleção de itens, utilizando caracteres textuais ("0" e "1") que exigiam múltiplos cliques para edição. 

*   **Formato Booleano:** A coluna `[x]` (Índice 1) retorna ao formato de **Checkbox visual nativo**, configurado via `SetColFormatBool` no motor da grade.
*   **Toggle Instantâneo (One-Click):** Implementação do vínculo ao evento `EVT_GRID_CELL_LEFT_CLICK` para alternar o estado de seleção imediatamente ao clique, sem entrar em modo de edição, disparando o `ForceRefresh` da célula no milissegundo do evento.
*   **Seleção Global:** O rótulo da coluna `[x]` agora atua como um seletor mestre via `EVT_GRID_LABEL_LEFT_CLICK`, marcando ou desmarcando todos os itens da grade simultaneamente.

## 2. Affordance e Navegação de Links
Para reforçar o perfil técnico de triagem da Aba 1, a coluna de **Link (URL)** foi restaurada com funcionalidades de navegação direta.

*   **Identidade Visual:** Aplicação mandatória da cor **azul** (`wx.BLUE`) no texto da coluna 2 para sinalizar a natureza de hiperlink.
*   **Cursor Dinâmico:** Uso do evento `EVT_MOTION` para transformar o cursor em "mão" (`wx.CURSOR_HAND`) quando o mouse paira sobre a URL, indicando clicabilidade.
*   **Acesso Web:** O clique na célula do link invoca o navegador padrão para abertura imediata do vídeo original.

## 3. Topologia e Estabilidade Estática
Diferente do Cockpit Analítico (Aba 2), a Aba 1 é blindada para garantir a **Prioridade Máxima de CPU** durante a ingestão massiva de dados.

*   **Layout Fixo:** Uso exclusivo de `wx.BoxSizer` vertical, sendo **terminantemente proibido** o uso de `wx.SplitterWindow` nesta aba para evitar instabilidades de redimensionamento.
*   **Saneamento de Colunas:** A coluna de Miniatura (Thumbnail) foi removida da Aba 1 para maximizar o espaço para metadados técnicos e reduzir o consumo de memória durante o scroll.

## 4. Ordem Mandatária das 11 Colunas (SSoT)
A grade técnica deve seguir rigorosamente a sequência abaixo para garantir a consistência com os processos de triagem:

1.  **#** (Índice cronológico).
2.  **[x]** (Checkbox de seleção).
3.  **Link** (URL do YouTube).
4.  **Título** (Extraído pelo sistema).
5.  **Canal** (Autor do vídeo).
6.  **Publicado** (Data de upload).
7.  **Adicionado** (Data de entrada no app).
8.  **Playlist** (Título da coleção).
9.  **Duração** (Tempo total HH:MM:SS).
10. **Tokens** (Contagem da TokenEngine).
11. **Status** (Estado de processamento colorido).

---
**Assinatura Técnica:** Engenharia ContextFlow - Usabilidade para o Analista Solo.