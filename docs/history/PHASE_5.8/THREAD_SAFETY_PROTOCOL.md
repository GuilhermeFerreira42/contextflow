Este documento estabelece o protocolo mandatório de segurança de threads para a **Fase 5.8**, garantindo que a comunicação entre o motor de processamento assíncrono e a interface de usuário (UI) não resulte em falhas críticas ou encerramento inesperado do sistema.

# docs/history/PHASE_5.8/THREAD_SAFETY_PROTOCOL.md

### 1. Contexto de Concorrência
O sistema ContextFlow opera em um ambiente multithreaded onde o **Processor** executa tarefas pesadas em threads secundárias (Worker Threads), enquanto a interface gráfica (wxPython) exige execução exclusiva na thread principal (Main Thread). A falha em observar este isolamento é a causa primária de instabilidades em sistemas desktop complexos.

### 2. O Papel do AppState (Single Source of Truth)
O `AppState` atua como o mediador central e utiliza um **`threading.RLock`** (Recursive Lock) interno para garantir a integridade dos dados durante operações concorrentes entre a Thread do Processor e a Thread da UI.
*   **Acesso Seguro:** Toda leitura ou mutação no estado global (vídeos e tarefas ativas) é protegida por este bloqueio, garantindo que o sistema mantenha uma "Única Fonte de Verdade".
*   **Persistência Não-Bloqueante:** Operações de escrita no banco de dados SQLite, embora rápidas, são delegadas para threads separadas (`_persist_video_worker` ou `_delete_worker`) para garantir que a interface nunca sofra "congelamentos" perceptíveis.

### 3. O Mandato wx.CallAfter
Para qualquer callback que resulte em manipulação de elementos da GUI (como labels de status, barras de progresso ou atualização de grids), o uso de **`wx.CallAfter`** é obrigatório.
*   **Delegação de Execução:** O `wx.CallAfter` delega a chamada da função para a `MainLoop` do wxPython.
*   **Implementação no AppState:** O método `_notify` do `AppState` já implementa esta lógica preventivamente: se um aplicativo wx estiver rodando, ele utiliza `wx.CallAfter` para notificar os observadores, protegendo automaticamente a UI.
*   **Segurança no Console:** O `ConsolePanel` também verifica internamente se a execução está na thread principal através de `wx.IsMainThread()`, redirecionando via `wx.CallAfter` se necessário.

### 4. Perigos do Barramento de Eventos (PubSub)
O sistema **PubSub** exige atenção redobrada, pois os callbacks são executados na **Thread do Publisher**.
*   Se o `Processor` (Thread secundária) publica um evento como `TASK_PROGRESS`, o assinante da UI receberá esse sinal fora da thread principal.
*   **Regra de Ouro:** Assinantes de UI que escutam tópicos do PubSub devem envolver suas atualizações visuais em `wx.CallAfter` para evitar crashes fatais.

### 5. Diretrizes para a Aba 1 (TabBatch)
Como parte da restauração funcional da Aba 1 na Fase 5.8:
1.  **Registro de Observador:** A `TabBatch` deve se registrar no `AppState`, que por padrão já gerencia a segurança de notificação via `CallAfter`.
2.  **Unificação de Dados:** O snapshot de dados gerado pela união de tarefas ativas e vídeos persistidos deve ocorrer dentro do bloqueio (`RLock`) para evitar inconsistências durante a iteração da lista.
3.  **Proteção de Diálogos:** Caixas de mensagem (`wx.MessageBox`) e diálogos de progresso disparados por eventos assíncronos devem obrigatoriamente seguir o protocolo de delegação para a thread principal.

Este protocolo é um componente essencial da "Lei da Estabilidade" e deve ser rigorosamente seguido em todos os novos desenvolvimentos de interface.