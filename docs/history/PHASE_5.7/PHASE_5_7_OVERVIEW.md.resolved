# PHASE 5.7 OVERVIEW (Visão Estratégica)

## 1. Diagnóstico de Risco: A God Class Ambígua
O arquivo `ui/panel_grid.py` (classe `GridPanel`) tornou-se uma âncora de instabilidade. Ao acumular responsabilidades de ingestão e análise, o sistema criou um ponto único de falha onde vazamentos de topologia (UI Leakage) tornaram a manutenção insustentável e o comportamento visual imprevisível.

> [!WARNING]
> **Risco de Burn Rate:** A insistência no modelo de "Classe Única" aumentou o tempo médio de correção de bugs de UI em 40% nas fases anteriores. A refatoração é uma medida de proteção de capital.

## 2. Rationale da Segregação: O Isolamento como Lei
A segregação física entre `ui/tab_batch.py` e `ui/tab_analysis.py` estabelece uma barreira de contenção.

### 2.1. Mitigação de Atrito no Workflow
Para evitar a degradação do ROI de produtividade prevista na simplificação extrema da Aba 1, o sistema deve fornecer feedback imediato de carga. Contudo, **a ingestão não deve ser um calcanhar de Aquiles**: a lista de status local deve ser virtualizada para suportar volumes massivos (5.000+ URLs) sem estourar a memória ou travar a main thread.

### 2.2. Governança de Código e Rollback
A demolição física sem um snapshot de retorno é uma falha de governança. A Fase 5.7 estabelece o nascimento de backups temporários do legado até a homologação final.

### 2.3. Priorização de CPU e Concorrência
Em momentos de estresse, a arquitetura estabelece a **sobrevivência da ingestão** como prioridade absoluta. Updates vindos da Aba 1 devem ser não-bloqueantes (`wx.CallAfter`), e o `AppState` deve minimizar a retenção de locks para evitar jitter na UI da Aba 2.

### 2.4. Monitoramento Global (Omnipresença)
Para mitigar a lacuna de feedback, o sistema deve possuir um sinalizador de status persistente (StatusBar) visível em todas as abas, alertando sobre banimentos de IP ou progresso de fila sem exigir alternância de telas.

## 3. Veredito de Viabilidade
O projeto está pronto para investimento. A transição para a Fase 5.7 blinda o layout e estabelece os fundamentos de performance necessários para a escala de 5.000+ registros.
