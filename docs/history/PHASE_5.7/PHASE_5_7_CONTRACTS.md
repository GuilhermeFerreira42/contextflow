# PHASE 5.7 CONTRACTS (Comunicação Desacoplada)

## 1. O Protocolo "Zero-Knowledge"
As abas operam em isolamento total. Nenhuma aba possui referência de instância da outra.

## 2. Orquestração e Proteção de Performance

### 2.1. Cadastro e Ingestão (Aba 1)
*   `TabBatch` comunica-se apenas com o `Processor` via `AppState`.
*   Feedback local via `TASK_PROGRESS`.

### 2.2. Reatividade e Throttling (Aba 2)
A `TabAnalysis` deve reagir aos eventos de conclusão através de um **Timer de Debounce (250ms)**, com prioridade de execução inferior às tarefas da Aba 1.

*   **Contrato de Visualização:** O `SummaryPanel` na Aba 2 deve iniciar exibindo um template de "Boas-vindas/Instruções" em HTML formatado (CSS Dark). Ao selecionar um vídeo sem transcrição ou resumo, o painel deve executar `Clear()` e retornar ao template neutro ou exibir "Nenhum conteúdo disponível".

## 3. Fluxo de Reset
*   Ao disparar um `on_delete` ou `on_clear`, todas as abas devem resetar seus estados internos independentemente:
    *   `TabBatch`: Limpa lista de status.
    *   `TabAnalysis`: `grid.Clear()`, `SummaryPanel.Clear()`.
