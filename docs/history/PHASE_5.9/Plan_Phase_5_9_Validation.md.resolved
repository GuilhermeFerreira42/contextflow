# Plan_Phase_5_9_Validation.md: Plano de Validação do Cockpit Analítico

Este documento estabelece os **critérios de aceite e protocolos de teste** para a homologação da **Fase 5.9**, focada na restauração visual e funcional da **Aba 2 (Cockpit Analítico)** dentro da arquitetura segregada. O objetivo é garantir que o sistema suporte **10.000 vídeos** com fluidez industrial e reatividade inteligente.

## 1. Testes de Performance e Estresse (10k)

O Cockpit Analítico deve processar metadados visuais pesados sem comprometer a responsividade global do sistema.

*   **P01: Latência de Scroll:** Com 10.000 itens carregados no **AppState**, a rolagem da grade virtual deve manter estáveis **60 FPS**.
*   **P02: Renderização de Célula:** O tempo de resposta do método `GetValue` na `VirtualVideoTable` deve ser inferior a **0.1ms**, mesmo com o processamento de thumbnails e tags ativas.
*   **P03: Consumo de Memória:** O uso total de RAM não deve exceder **250MB** sob carga massiva, validando a eficiência do **LRU Cache** para as miniaturas.
*   **P04: Time To Interactive (TTI):** A grid deve responder a comandos de scroll ou clique em menos de **50ms**.

## 2. Validação de Layout e Reatividade (Splitter)

O layout **Master-Detail** deve operar de forma adaptativa e isolada.

*   **L01: Estado Inicial:** O `wx.SplitterWindow` deve iniciar obrigatoriamente em modo **Unsplit** (painel inferior oculto) para preservar a área útil da grade.
*   **L02: Lógica "Smart Show":** Ao selecionar um vídeo que possua resumo ou transcrição, o painel inferior deve expandir-se automaticamente para exibir o conteúdo.
*   **L03: Debouncing de Refresh:** A interface da Aba 2 deve aguardar um silêncio de eventos de **250ms (Restart-on-Event)** antes de atualizar a lista, evitando travamentos durante a ingestão na Aba 1.
*   **L04: Persistência de Visão:** Durante o período de debounce, a grid deve **persistir o último snapshot válido**, proibindo refrescos parciais ou "piscadas" visuais.

## 3. Integridade Estética e Funcional

A Aba 2 deve refletir a identidade visual **Moderno/Tailwind** solicitada no mockup.

*   **E01: Renderização Rica:** Validar se as **thumbnails (80x45)** possuem cantos arredondados e se as **tags de contexto** são exibidas como pílulas visuais (chips).
*   **E02: Hierarquia de Texto:** O título do vídeo deve aparecer em **negrito** com o nome do canal em *itálico* logo abaixo na mesma célula.
*   **E03: Governança Financeira:** O dashboard superior deve exibir em tempo real o **gasto acumulado da sessão** e a contagem total de tokens consumidos.
*   **E04: Affordance de Link:** A coluna de links deve exibir texto em **azul** e alterar o cursor para "mão" (`wx.CURSOR_HAND`) ao pairar o mouse.

## 4. Auditoria de Segregação (Zero-Knowledge)

A restauração da Aba 2 não pode reintroduzir acoplamentos técnicos com a Aba 1.

*   **A01: Isolamento de Contexto:** Nenhuma importação de `ui/tab_batch.py` deve existir no código da `ui/tab_analysis.py`.
*   **A02: Sincronia SSoT:** Todas as mutações visuais foram derivadas exclusivamente de notificações do **AppState** ou do barramento **PubSub**.
*   **A03: Thread-Safety:** Todas as atualizações de interface vindas de threads secundárias (Processor) devem ser envelopadas em **`wx.CallAfter`**.

---
**Critério de Conclusão:** A Fase 5.9 será considerada homologada quando **100% dos testes acima** apresentarem status **PASS** sob uma carga de teste de no mínimo 5.000 vídeos reais.
