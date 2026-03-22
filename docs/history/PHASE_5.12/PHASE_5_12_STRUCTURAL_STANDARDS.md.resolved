# PHASE 5.12 STRUCTURAL STANDARDS: Blindagem Arquitetural e Governança

**Status:** SSoT (Fonte Única de Verdade)
**Função:** Blindar o projeto contra caos estrutural e garantir a prontidão para a Fase 6.
**Referências:** Auditoria de Governança v24, `app_state.py`, `constants.py`.

--------------------------------------------------------------------------------

## 1. Padrão de Persistência

Para garantir a integridade dos dados e a sobrevivência das configurações do usuário, o sistema adota um **modelo híbrido de persistência**.

• **Configurações e Insumos (JSON):**
    ◦ **Arquivo:** `config/credentials.json`.
    ◦ **Quem escreve:** Exclusivamente o `ConfigManager` através de métodos atômicos.
    ◦ **Quem lê:** Qualquer componente via Singleton do `ConfigManager`.
    ◦ **Quando é salvo:** No gatilho do botão "SALVAR" do diálogo de configurações, disparando o método `update_physical_files()` para sincronizar cookies e proxies físicos.

• **Dados Operacionais e Histórico (SQLite):**
    ◦ **Arquivo:** `contextflow.db` (tabelas `videos`, `system_config`, `ai_usage_log`).
    ◦ **Quem escreve:** `DatabaseHandler` sob demanda do `Processor` ou mutações do `AppState`.
    ◦ **Quando é salvo:** Instantaneamente em cada transição de estado de tarefa ou detecção de erro.

## 2. Estado Global (SSoT)

O gerenciamento de estado obedece ao princípio da **Fonte Única de Verdade** para evitar inconsistências entre as abas independentes.

• **Store Central:** Singleton `AppState`.
• **Thread Safety:** Todas as mutações de estado (adição, deleção ou promoção de tarefas) devem ocorrer sob a proteção do `threading.RLock` interno.
• **Quem altera estado:** O `Processor` (resultados de extração) e o `AppWindow` (deleções/configurações).
• **Quem apenas consome:** As abas de interface (`TabBatch`, `TabAnalysis`), que recebem atualizações exclusivamente via **PubSub** ou **Observer Pattern**.
• **Segurança de UI:** Atualizações gráficas disparadas por mudanças de estado devem ser obrigatoriamente envelopadas em `wx.CallAfter`.

## 3. Design System Interno

Para evitar a criação de uma "Interface Frankenstein", todos os novos componentes da Fase 5.12 devem seguir rigorosamente estes tokens:

• **Tokens Visuais (Light Mode):** Mandatory use of `COLOR_BG` (Branco), `COLOR_FG` (Cinza Escuro) e `COLOR_ACCENT` (Azul).
• **Renderizadores de Grade:** Uso obrigatório de `SafeTextRenderer` com a chamada `dc.SetClippingRegion(rect)` para eliminar o vazamento de texto entre células.
• **Feedback Visual:**
    ◦ **Loading/Esforço:** Utilização de `wx.Gauge` para progresso determinado.
    ◦ **Semântica de Logs:** Azul para Sistema/Informação, Laranja para Avisos e Vermelho para Erros/Falhas.
• **Padronização de Nomenclatura:** Substituição de termos técnicos por operacionais amigáveis: "Intervalo de Espera" (Cooldown), "Limite de Tentativas Falhas" (Erro 429) e "Processamento Simultâneo" (Tasks).

## 4. Escopo Congelado

Conforme determinação de governança administrativa, os limites desta fase são imutáveis.

**Nenhuma funcionalidade adicional de inteligência artificial ou análise semântica será adicionada nesta fase.**

• **Incluído:** Gestão visual de Cookies/Proxies, parametrização de limites de fila, toggle de defesa e unificação de temas.
• **Interditado:** Chamadas a APIs de resumo (OpenAI, Gemini), integração de modelos locais (Ollama), tags automáticas ou busca vetorial.

--------------------------------------------------------------------------------

**Critério de Homologação:** A estrutura da Fase 5.12 será considerada concluída quando o sistema for capaz de persistir a prioridade de idiomas e os insumos de rede no arquivo JSON, respeitando o isolamento entre abas e o Design System sem vazamentos visuais.
