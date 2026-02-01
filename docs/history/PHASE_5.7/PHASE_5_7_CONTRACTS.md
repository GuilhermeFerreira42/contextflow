# PHASE 5.7 CONTRACTS (Comunicação Desacoplada)

## 1. O Protocolo "Zero-Knowledge" (Cláusula Pétrea)
As abas operam em isolamento total. Nenhuma aba possui referência de instância da outra. **É terminantemente proibido importar classes ou arquivos de uma aba dentro da outra.** 
- **Exemplo de Violação:** `import ui.tab_batch` dentro de `ui.tab_analysis`.
- **Consequência:** Rollback imediato e falha na auditoria de integridade.

## 2. Orquestração de Dados (AppState e PubSub)
*   Toda comunicação inter-aba deve ocorrer exclusivamente através do Singleton `AppState` (Estado) e do Barramento `PubSub` (Eventos).
*   Se a Aba 1 adiciona um vídeo, ela atualiza o `AppState`. A Aba 2 deve observar essa mudança via `PubSub` ou `AppState.register_observer`.
*   A Aba 3 (`panel_detail`) carrega dados sob demanda via `AppState.get_video()`.

## 3. Orquestração e Proteção de Performance

### 3.1. Cadastro e Ingestão (Aba 1)
*   `TabBatch` comunica-se apenas com o `Processor` via `AppState`.
*   Feedback local via `TASK_PROGRESS`.

### 3.2. Reatividade e Throttling (Aba 2)
A `TabAnalysis` deve reagir aos eventos de conclusão através de um **Timer de Debounce (250ms)**, com prioridade de execução inferior às tarefas da Aba 1 para garantir que a interface de carga permaneça responsiva.

## 4. Fluxo de Reset
*   Ao disparar um `on_delete` ou `on_clear`, todas as abas devem resetar seus estados internos independentemente via notificações `PubSub`.
