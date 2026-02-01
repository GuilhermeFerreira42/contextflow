# PHASE 5.7 EXECUTION (Roteiro de Refatoração)

> **Status:** SSoT (Fonte Única de Verdade) - Operação de Sobrevivência
> **Meta:** Segregação Física de UI e Demolição do Legado
> **Data de Início:** 01 de Fevereiro de 2026

## 1. Protocolo de Saneamento e Demolição

### Passo 0: Mandato de Extinção Física (Crítico)
*   **Ação Mandatória:** Os arquivos `ui/panel_grid.py` e `ui/panel_grid.py.bak` devem ser **DELETADOS FISICAMENTE** do sistema de arquivos antes de qualquer nova linha de código ser escrita.
*   **Objetivo:** Impedir que a IA utilize o legado como "muleta" ou realize heranças de uma God Class instável.

### Passo A: Nascimento das Novas Entidades
*   **Implementar `ui/tab_batch.py`:** Criar interface leve para ingestão massiva baseada em `wx.BoxSizer`, sem virtualização de grid.
*   **Implementar `ui/tab_analysis.py`:** Criar o cockpit Master-Detail utilizando `wx.SplitterWindow` e integrando a `VirtualVideoTable`.
*   **Configurar Reatividade:** Implementar o `wx.Timer` com lógica de **Restart-on-Event** (250ms) para proteger a UI durante picos de dados.

### Passo B: Auditoria de Integridade e Testes
*   **Saneamento de Imports:** Atualizar todos os arquivos na pasta `tests/` para remover referências ao antigo `GridPanel`.
*   **Auditoria "No-Circular-Imports":** Executar script de verificação para garantir que `ui/tab_batch.py` e `ui/tab_analysis.py` operem sob regime **Zero-Knowledge** (sem se importarem mutuamente).
*   **Validação de Performance:** Executar `pytest tests/test_virtual_table_perf.py` para garantir renderização de 1.100 células em < 50ms para um lote de 10.000 itens.

### Passo C: Reintegração na AppWindow
*   **Instanciação:** Atualizar `ui/app_window.py` para carregar as novas abas no `wx.Notebook`.
*   **Indicador Global:** Implementar o sinalizador de status persistente no `StatusBar` para monitorar progresso de fila e erros 429 visíveis em todas as telas.

## 2. Gestão de Risco Operacional

*   **Critério de Aborto:** Se a auditoria de importação circular falhar no Passo B, a implementação deve sofrer rollback imediato.
*   **Prioridade de Ingestão:** Durante a carga de 10.000 URLs, a Aba 1 deve manter prioridade absoluta de CPU; a Aba 2 deve ser renderizada com prioridade `wx.IDLE`.

## 3. Definição de Concluído (DoD)

- [ ] Arquivo `ui/panel_grid.py` removido do disco.
- [ ] Topologia de 3 abas funcional e independente.
- [ ] Timer de 250ms (Restart-on-Event) validado.
- [ ] RAM < 250MB sob carga de 10.000 vídeos.
- [ ] Zero erros de importação circular entre componentes de UI.