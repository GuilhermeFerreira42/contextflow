# Plan Phase 5.7 Validation (Topology Segregation)

## Objetivo
Validar se a segregação física das classes de UI resolveu a instabilidade de layout e o vazamento de estado visual entre as abas de Importação (Batch) e Análise (Cockpit).

## Roteiro de Teste (Smoke Test)

### Teste A: Isolamento de Layout e Redimensionamento
1.  Abra o ContextFlow.
2.  Navegue até a **Aba 2 (Análise)**.
3.  Ajuste o *Sash* do Splitter (se visível) ou redimensione a janela principal agressivamente.
4.  Retorne para a **Aba 1 (Dados/Batch)**.
5.  **Resultado Esperado:** O campo de texto e os botões devem estar perfeitamente alinhados, sem artefatos visuais da Grid ou espaços vazios deixados pelo Splitter da outra aba.

### Teste B: Exclusividade da Grid Virtual
1.  Verifique se a `VirtualVideoTable` (Grid com colunas de Thumbnail, Título, etc.) aparece **apenas** na Aba 2.
2.  Tente usar o scroll na Aba 2.
3.  Navegue para a Aba 1.
4.  **Resultado Esperado:** A Aba 1 não deve possuir barra de rolagem da Grid nem tentar renderizar células da tabela em background.

### Teste C: Sincronização via AppState
1.  Na Aba 1, adicione uma URL válida e clique em "Processar".
2.  Acompanhe o status na Aba 1 até a conclusão.
3.  Mude para a Aba 2.
4.  **Resultado Esperado:** O novo vídeo já deve estar visível na Grid sem necessidade de refresh manual ou mudança de aba para "despertar" o componente.
