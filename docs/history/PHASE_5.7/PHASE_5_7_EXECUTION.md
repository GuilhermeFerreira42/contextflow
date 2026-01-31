# PHASE 5.7 EXECUTION (Roteiro de Refatoração)

## 1. Protocolo de Saneamento e Demolição

### Passo A: Nascimento das Novas Entidades
*   Implementar `ui/tab_batch.py` (com ListCtrl de status simplificado).
*   Implementar `ui/tab_analysis.py` (com Splitter, VirtualGrid e Throttling logic).

### Passo B: Saneamento Mandatório de Testes
*   **Ação Crítica:** Atualizar todos os `import` na pasta `tests/`.
*   **Auditoria de Lógica:** Validar especificamente o arquivo `tests/verify_architecture.py` para garantir que o desacoplamento via PubSub não quebrou as regras de negócio.
*   Executar `pytest` para garantir zero regressões.

### Passo C: Snapshots de Segurança (Rollback Protocol)
*   **Ação Mandatória:** Criar cópia de segurança: `cp ui/panel_grid.py ui/panel_grid.py.bak`.

### Passo D: Reintegração na AppWindow
*   Substituir instâncias de `GridPanel` e implementar o **Indicador Visual Global** no Footer.

### Passo E: Demolição Final e Auditoria de Órfãos
*   **Auditoria de Arquivos:** Verificar `ui/virtual_table.py` para garantir ausência de referências circulares ao antigo `panel_grid.py`.
*   **Limpeza:** Deletar `ui/panel_grid.py` e seu `.bak`.

## 2. Gestão de Risco Operacional
Se os testes falharem no Passo B, a demolição deve ser abortada. Não aceitaremos um sistema sem cobertura de auditoria automatizada.
