# ARCHITECTURE: A Lei da Estabilidade (AMV)

> **Princípio Mestre:** Estabilidade Operacional > Features Complexas.
> **Alvo:** Ferramenta robusta para uso pessoal de longo prazo.

## 1. Padrões de Sobrevivência

### 1.1. Motor de Grid Virtual (Performance)
O `panel_grid.py` monolítico será substituído pelo padrão `VirtualTable`.
*   **DataProxy:** A UI não toca no banco. Ela pede dados a um Proxy que gerencia cache em memória.
*   **Lazy Loading:** A Grid carrega 10.000 linhas instantaneamente porque só desenha o que está visível.
*   **Regra:** Se a Grid travar ao rolar, a arquitetura falhou.

### 1.2. Barramento de Mensagens (Desacoplamento)
*   **Zero Congelamento:** O download de um vídeo de 3 horas não pode congelar o clique de um botão.
*   **PubSub Obrigatório:** `Processor` e `UI` não se conhecem.
    *   `Processor` emite: `pub.sendMessage('TASK_UPDATED', data=...)`
    *   `UI` escuta e atualiza.

### 1.3. Isolamento de Serviços
Os módulos devem ser funcionalmente independentes.
*   **ExportService:** Responsável por ZIPar e salvar arquivos. Se a IA cair, a exportação bruta **deve** continuar funcionando.
*   **AIService:** Módulo plugável. Se falhar (sem quota, sem internet), o resto do app ignora.

## 2. Fluxo de Dados Seguro (Thread Safety)
```mermaid
graph TD
    UI[Grid UI] -->|Pede Dados| Proxy[DataProxy (Cache)]
    Proxy -->|Leitura Rápida| AppState
    
    UI -->|Comando| Processor[Worker Thread]
    Processor -->|I/O Pesado| YouTube/Disk
    Processor -->|Write| AppState[Singleton + Lock]
    AppState -->|Notify| PubSub
    PubSub -->|Update| UI
```
