# PHASE 6 EXECUTION (PLANO DE ATAQUE REFORMULADO)

**Diretriz:** Prioridade ao Fluxo de Dados e Validação de Custo (Back-to-Front).

1. **Sprint 6.1: Core IA & AIService (O Motor):**
   - Implementação do plugin `AIService` (OpenAI/Ollama).
   - Validação do fluxo de tokens e custos em ambiente real.
   - Implementação da tabela `summaries` e lógica `cache_first`.
   - *Sucesso:* Resumo gerado e persistido no DB sem depender de UI.

2. **Sprint 6.2: Integração Master-Detail Estática:**
   - Implementação do `SplitterWindow` na Aba 2.
   - Painel de Detalhes fixo ou manual (Sem "Smart Show" instável).
   - Conexão do PubSub `SUMMARY_READY` para preenchimento do painel.

3. **Sprint 6.3: Refino de UX Analítica:**
   - Implementação de Double-click para expansão de células.
   - Sistema de Sorting multi-coluna (Sorting real na Grid Virtual).

4. **Sprint 6.4: Burocracia e Polimento (Se houver ROI):**
   - Diálogo de Configurações (Apenas se a complexidade justificar, caso contrário manter via `config.json`).
   - Persistência de preferências de interface.


# Plano de Execução: Fase 6 - Estratégia de Implementação

## 1. Prioridade Imediata: Infraestrutura de Configuração
Antes de iniciar a reatividade da UI, precisamos garantir que o sistema de persistência e chaves de IA esteja funcional.

### [E-01] Config Manager & Settings Dialog
1.  **Criar** `storage/config_manager.py`: Singleton para gerenciar `user_settings.json` com métodos `get()` e `set()`.
2.  **Desenvolver** `ui/dialog_settings.py`:
    *   Implementar abas (Notebook) para IA, UX e Custos.
    *   Vincular campos ao `ConfigManager`.
    *   Vincular botão "Salvar" ao envio do evento `SETTINGS_CHANGED`.

## 2. Reestruturação do Workspace (Aba 2)
Transformar a atual Grid em um ambiente de análise Master-Detail.

### [E-02] Splitter Implementation (Aba 2)
1.  **Modificar** `ui/panel_grid.py`:
    *   Introduzir `wx.SplitterWindow`.
    *   Mover a Grid para o painel superior do Splitter.
    *   Instanciar um `DetailPanel` (específico para a base) no painel inferior.
2.  **Implementar Lógica "Smart Show"**:
    *   Assinar o evento de clique na Grid.
    *   Verificar metadados do vídeo selecionado.
    *   Expandir/Colapsar o Splitter baseado no modo configurado em `user_settings.json`.

## 3. Limpeza e Consolidação
Eliminar redundâncias conforme as diretrizes de auditoria.

### [E-03] Depreciação de Arquivos
1.  **Remover** `ui/panel_table.py` e `ui/tab_view.py`.
2.  **Atualizar** `ui/app_window.py` para refletir as 3 abas oficiais:
    *   Aba 1: Batch (Simples).
    *   Aba 2: Análise (Splitter).
    *   Aba 3: Leitura (Imersiva).

## 4. Validação Técnica
1.  **Teste de Estresse:** Validar se o scroll na Grid Virtual continua fluido durante a ativação/desativação do Splitter.
2.  **Teste de Persistência:** Fechar o app com o Splitter em uma posição X e garantir que ele retorne na mesma posição.
3.  **Teste de IA:** Alternar provedores no Diálogo de Configurações e verificar se o `Processor` assume a nova configuração sem reinicialização.
