# PHASE 5.8 REACTIVE ENGINE: Sincronização do Motor Reativo

> **Status:** Fonte Única de Verdade (SSoT)
> **Assunto:** Reatividade via Observer Pattern e Unificação de Snapshot
> **Data:** 02 de Fevereiro de 2026

## 1. Arquitetura de Observação
O Motor Reativo da Fase 5.8 é o componente central que garante a sincronia em tempo real entre o motor de processamento assíncrono e a interface de usuário. A Aba 1 (`TabBatch`) foi restaurada como um observador oficial do `AppState`, utilizando o método `register_observer` para monitorar qualquer mutação no estado global do sistema. Essa conexão direta permite que a interface "acorde" automaticamente sempre que um novo vídeo é enfileirado ou atualizado, eliminando a necessidade de polling manual.

## 2. Unificação de Dados (Atomic Snapshot)
Um pilar crítico da fluidez na Doca de Carga é a **Unificação de Visualização**. O método `_refresh_grid` realiza uma soma atômica de estados, combinando o retorno de `get_active_downloads()` com `get_all_videos()`.
*   **Identificação Híbrida:** A grade virtual suporta de forma transparente tanto tarefas em fila identificadas por **UUID** quanto vídeos persistidos no banco de dados identificados por **ID**.
*   **Visibilidade Imediata:** Essa abordagem elimina o atraso visual, garantindo que o vídeo apareça na lista no milissegundo em que a URL é processada e o evento `TASK_QUEUED` é emitido.

## 3. Protocolos de Estabilidade e Performance
Para suportar o teto de 10.000 itens sem degradação, o motor reativo utiliza regras rígidas de proteção:
*   **Thread-Safety Mandatário:** Todas as notificações de estado que afetam a GUI são obrigatoriamente envelopadas em `wx.CallAfter`, delegando a execução para a thread principal e evitando crashes por acesso concorrente.
*   **Debouncing "Restart-on-Event":** Implementação de um `wx.Timer` de 250ms que reinicia a cada novo sinal de atualização. A grade virtual só realiza o refresh atômico quando detecta um "silêncio" de 250ms, protegendo o sistema de flickering e refreshes excessivos durante ingestões massivas.
*   **Renderização Virtual:** O motor `VirtualVideoTable` mantém a latência de célula inferior a 0.1ms, solicitando ao `AppState` apenas os dados estritamente necessários para a área visível da tela.

## 4. Fluxo de Eventos e Feedback
O motor reativo traduz sinais do barramento PubSub em telemetria visual imediata:
1.  **Ingestão:** O botão "Processar" publica em `REQUEST_BATCH_PROCESSING`.
2.  **Ciclo de Vida:** O `Processor` emite sinais de `TASK_PROGRESS` para mensagens textuais e `TASK_COMPLETED` para finalização.
3.  **Triagem de Erro:** Falhas técnicas como o Erro 429 disparam o tópico `TASK_ERROR`, que o motor reativo utiliza para colorir o status da linha em **vermelho** instantaneamente.

---
**Assinatura Técnica:** Engenharia ContextFlow - Estabilidade e Reatividade Hardened.