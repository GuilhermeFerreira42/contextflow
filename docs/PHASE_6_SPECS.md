# PHASE 6 SPECS (ESPECIFICAÇÕES REFORMULADAS)

**1. Layout Aba 2 (Master-Detail Pragmático):**
- Implementação de `wx.SplitterWindow` na Aba 2.
- **Master (Topo):** `VirtualVideoTable`.
- **Detail (Base):** Painel de resumo persistente. 
- **Decisão Crítica:** Removido o "Smart Show" (expansão automática). O painel mantém posição definida pelo usuário ou estado binário (aberto/fechado) para evitar instabilidade visual ("pula-pula").

**2. AIService (O Core):**
- Abstração de provedores via Strategy.
- Verificação obrigatória de cache no SQLite antes de qualquer chamada externa.
- Estimativa de custo de tokens antes da execução (Governança).

**3. UX Analítica:**
- **Double-Click:** Expande célula de texto com scroll interno.
- **Sorting:** Cabeçalhos clicáveis com ordenação delegada ao `AppState`.

**4. Configurações:**
- Persistência inicial via `config.json`.
- UI de configurações (`SettingsDialog`) postergada para o final da fase para evitar desperdício de capital em funcionalidade de suporte.


----

# Especificações Técnicas: Fase 6 - Insights & UX Reativa

## 1. Visão Geral
A Fase 6 foca na transformação da experiência de análise de dados, introduzindo uma interface reativa que permite ao usuário visualizar insights sem perder o contexto da triagem.

## 2. Segregação de Interface (Impositivo)

O sistema deve consolidar a interface em 3 abas principais, eliminando arquivos redundantes (`panel_table.py`, `tab_view.py`).

| Aba | Nome Interno | Componente Base | Descrição | Restrições |
| :--- | :--- | :--- | :--- | :--- |
| **Aba 1** | **BatchPanel** | `ui/panel_grid.py` (Refat) | Entrada de URLs e botões de comando. | **Proibido Splitter.** Layout simples e direto. |
| **Aba 2** | **AnalysisPanel** | `ui/panel_grid.py` (Refat) | Grade Virtual com Splitter de detalhes. | **Única aba com Splitter.** Topo: Grid / Base: Detail. |
| **Aba 3** | **ReadPanel** | `ui/panel_detail.py` | Visualização imersiva em tela cheia. | Sem alterações de layout; apenas recepção de dados. |

## 3. Comportamento do Splitter "Smart Show"

### 3.1. Estado Inicial
*   O painel de detalhes na Aba 2 deve iniciar **colapsado/oculto**.
*   Utilizar `Unsplit` ou `SetSashPosition(0)` na inicialização.

### 3.2. Gatilhos de Expansão (Reatividade)
*   **Automático:** Ao selecionar um vídeo na Grid que possua `has_summary == True`.
*   **Manual:** Ao clicar no botão "Ver Detalhes" na barra de ações da Aba 2.
*   **Configuração de Comportamento:** O usuário pode definir o comportamento no diálogo de configurações (Adaptativo, Sempre Aberto, Sempre Fechado).

### 3.3. Persistência
*   A posição do divisor (*Sash*) deve ser persistida via `ConfigManager` no arquivo `user_settings.json`.

## 4. Diálogo de Configurações (`ui/dialog_settings.py`)

Substitui placeholders e mensagens de erro básicas por uma interface real.

### Abas do Diálogo:
1.  **IA (Inteligência Artificial):**
    *   Seleção de Provedor (OpenAI / Ollama).
    *   Campo mascarado para API Key.
    *   Configuração de modelo padrão.
2.  **UX (Experiência do Usuário):**
    *   Comportamento do Splitter na Aba 2.
    *   Opções de tema (Dark/Light).
3.  **Custos:**
    *   Painel de telemetria de gastos da sessão.
    *   Definição de teto financeiro (Hard Limit) para interrupção de processos.

## 5. Performance e Renderização
*   **Grid Virtual:** O método `GetValue` deve ser otimizado para execução em < 0.1ms.
*   **Thumbnails na Grid:** Manter a exibição de thumbnails na Grid Virtual (Aba 2), garantindo carregamento assíncrono ou via cache para não impactar a rolagem.
*   **Thumbnail Cache:** Utilizar o sistema de cache existente para evitar I/O excessivo durante o scroll.
