# Plan Phase 5.7 Validation (Critérios de Aceite)

## 1. Testes de Isolamento e Integridade

### Teste A: Isolamento Topológico (Vazamento)
*   Redimensionamento agressivo na Aba 2 não deve impactar o alinhamento da Aba 1.

### Teste B: Auditoria da Suite de Testes
*   Execução bem-sucedida de todos os testes na pasta `tests/` após a demolição do arquivo legado. **Falha aqui invalida a fase.**

## 2. Métricas de Viabilidade (TTI e Performance)

### Teste C: Escalabilidade de Ingestão (Stress Test)
1.  Importar uma lista simulada de 5.000 URLs na Aba 1.
2.  **Critério de Sucesso:** A Aba 1 não deve apresentar "Not Responding" no Windows nem consumo de RAM exponencial. O scroll na lista de status deve ser fluido (indício de virtualização).

### Teste D: Time To Insight (TTI) e Prioridade
1.  Durante a carga massiva do Teste C, mude para a Aba 2.
2.  **Critério de Sucesso:** A Aba 2 deve atualizar a Grid em blocos (consequência do Debounce/Throttling). A Aba 1 não deve sofrer atrasos na recepção de metadados por causa dos refreshes da Aba 2.

## 3. Validação de Auditoria e Governança
*   **Backup & Orphan Check:** Confirmar que `panel_grid.py.bak` foi removido e que `ui/virtual_table.py` não possui importações circulares do legado.
*   **Global Awareness Check:** O indicador de status no Footer da janela permanece visível e funcional mesmo durante a operação na Aba 2.
*   **No-Stutter Scroll:** O scroll na Aba 2 deve ser imune a bloqueios de escrita vindos da Aba 1 (Snapshot read no `AppState`).
