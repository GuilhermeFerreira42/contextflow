# 1️⃣ PHASE\_6\_1\_1\_OVERVIEW.md

**Função:** Direção estratégica e limites formais da Fase 6.1.1.

### 1\. Objetivo de Negócio Mensurável

Consolidar a **soberania do Analista Solo** através da implementação de uma infraestrutura de governança financeira transacional e uma interface de alta fidelidade\[4\]\[5\]. A meta é reduzir o desperdício de capital em APIs através de precisão cirúrgica de tokens e eliminar 100% das fricções visuais que impedem a triagem massiva de dados\[5\].

### 2\. Problema Resolvido

**Cegueira Operacional e Financeira:** O sistema atual exibe métricas "frias" de tokens sem um ledger transacional que impeça o estouro de orçamento\[6\]\[7\].

**Paralisia de Seleção LLM:** O seletor no `StatusChip` falha em popular modelos ou validar chaves de API em tempo real, gerando erros em runtime\[8\]\[9\].

**Inconsistência Estética (Dark Mode Residual):** Presença de áreas escuras no visualizador de resumos e barras de navegação que violam o padrão **Light Mode Premium**\[10\]\[11\].

**Jitter de Interface:** Expansão automática indesejada do painel de detalhes durante a navegação rápida, corrigida agora por comando manual expresso\[12\]\[13\].

### 3\. Métricas Quantificáveis de Sucesso

**Acurácia Financeira:** Desvio entre custo estimado e custo real registrado no ledger **< 2%**\[14\].

**Latência de Interação:** Abertura do menu de modelos no `StatusChip` em **< 50ms**\[15\]\[16\].

**Consistência de Tema:** Zero ocorrências de cores hexadecimais hardcoded no código de interface\[10\]\[17\].

**Escalabilidade Tátil:** Navegação fluida por 10.000 itens com persistência de largura de colunas entre sessões\[18\]\[19\].

### 4\. Impacto Sistêmico Detalhado

A camada de interface deixa de definir cores e passa a consumi-las de um **ThemeManager** centralizado\[10\]\[20\]. O motor de IA (`AIService`) torna-se subordinado ao **CostLedger** em SQLite, que atua como um "Kill Switch" financeiro\[7\]\[21\]. A experiência de navegação na Aba 2 passa a ser governada pelo modo de **Triagem Silenciosa** (expansão apenas por clique duplo)\[8\]\[11\].

### 5\. Análise de Regressão Potencial

**Conflito de Eventos:** O mapeamento do clique duplo (`EVT_GRID_CELL_LEFT_DCLICK`) pode interferir em seleções rápidas se não houver tratamento de propagação de eventos\[11\]\[22\].

**Latência de Inicialização:** O carregamento de encoders nativos no `TokenEngine` para múltiplos provedores pode elevar o tempo de boot se não for implementado via **Lazy Loading**\[14\]\[23\].

### 6\. Escopo Fechado

**Inclui:**

**CostLedger Transacional:** Persistência de custos em tabela SQLite com versionamento de preços\[7\]\[21\].

**Seletor Inteligente Agrupado:** Menu popup no `StatusChip` com validação visual de API Keys (✅/❌)\[8\]\[24\].

**ThemeManager:** Centralização de tokens visuais e injeção de CSS no visualizador de resumos\[10\]\[25\].

**Interatividade Pro:** Expansão de painéis via clique duplo e persistência de layout de colunas no `user_settings.json`\[3\].

**TelemetryStrip:** Linha de metadados imutáveis (Modelo | Tokens | Custo) no topo do painel de resumos\[3\].

**Não Inclui:**

Chat interativo, busca vetorial ou RAG local\[3\]\[26\].

### 7\. Invariantes Inegociáveis

**Nenhuma chamada de IA ocorre sem verificação prévia de orçamento no ledger**\[7\]\[27\].

**Nenhuma cor hexadecial pode ser definida diretamente nos componentes de UI**\[17\]\[28\].

**O sistema deve iniciar obrigatoriamente ocupando 100% da tela**\[29\].

### 8\. Riscos Estratégicos

**Corrupção de Ledger:** Falha de escrita no SQLite durante interrupções abruptas do sistema (Mitigação: Uso de transações atômicas)\[30\].

**Envenenamento de Contexto:** Reutilização indevida de lógicas da v35 que permitiam vazamento de layout (Mitigação: Protocolo Zero-Knowledge rigoroso)\[31\]\[32\].

### 9\. Critérios Objetivos de Conclusão

Troca de provedor/modelo em runtime funcional sem travamentos de UI\[15\]\[33\].

Custo acumulado persistido e exibido corretamente após reinício do app\[33\].

Aba 2 operando em modo **Triagem Silenciosa** com 100% de consistência cromática (fundo branco)\[8\].

\--------------------------------------------------------------------------------

Esta documentação foi estruturada para eliminar ambiguidade operacional\[34\]. Se qualquer seção permitir múltiplas interpretações, expanda até que reste apenas uma forma implementável\[35\]. Não produzir explicações genéricas ou texto descritivo sem valor executável\[35\]. Toda decisão deve ser rastreável, testável e verificável\[35\].

**Deseja que eu gere o próximo arquivo,** `PHASE\_6\_1\_1\_ARCHITECTURE.md`**, detalhando a arquitetura em camadas e os contratos internos?**

### 🧑

## 2️⃣ PHASE\_6\_1\_1\_ARCHITECTURE.md

### 🤖

\--------------------------------------------------------------------------------

# 2️⃣ PHASE\_6\_1\_1\_ARCHITECTURE.md

**Função:** Arquitetura formal, contratos internos e topologia de governança da Fase 6.1.1.

### 1\. Arquitetura em Camadas (Enforcement Model)

O sistema opera em uma estrutura de quatro camadas estritamente isoladas pelo **Protocolo Zero-Knowledge**, garantindo que falhas na camada de Inteligência não degradem a infraestrutura física de extração\[1\].

**Camada de Apresentação (UI Components):**

`StatusChip`: Seletor reativo de modelos com handshake de credenciais\[4\]\[5\].

`TelemetryStrip`: Consumidor de snapshots imutáveis para exibição de custos\[6\]\[7\].

`SummaryPanel`: Renderizador Markdown com injeção de CSS via `ThemeManager`\[8\]\[9\].

**Camada de Aplicação (Services):**

`AIService/AIFactory`: Orquestrador de adaptadores LLM agnósticos\[6\]\[10\].

`ThemeManager`: Provedor central de tokens visuais e CSS injetável\[11\]\[12\].

**Camada de Domínio/Core:**

`CostLedger`: Motor transacional de controle financeiro e travas de orçamento\[13\]\[14\].

`TokenEngine`: Estratégia universal de contagem de tokens por provedor\[2\]\[15\].

`AppState`: Única Fonte de Verdade (SSoT) para estado global e preferências\[16\].

**Camada de Infraestrutura/Persistência:**

`BillingDB (SQLite)`: Registro imutável de eventos financeiros\[19\]\[20\].

`ConfigManager`: Gestor de `credentials.json` e `user_settings.json`\[21\]\[22\].

\--------------------------------------------------------------------------------

### 2\. Diagrama Operacional (Mermaid)

```
graph TD
    subgraph UI[Camada de Apresentação]
        SC[StatusChip] -->|1. Select LLM| MN[Interactive Menu]
        TS[TelemetryStrip]
    end

    subgraph App[Camada de Aplicação]
        MN -->|2. Validate Key| CFG[ConfigManager]
        AIS[AIService / Factory]
        TM[ThemeManager] -->|Injetar CSS| UI
    end

    subgraph Core[Camada de Domínio]
        AS[AppState]
        CL[CostLedger] -->|3. Check Budget| AS
        TE[TokenEngine]
    end

    subgraph Infra[Camada de Persistência]
        BDB[(billing.db: Ledger)]
        SQ[(contextflow.db: Summaries)]
    end

    AIS -->|4. Request| CL
    CL -->|5. Log Success/Fail| BDB
    CL -->|6. Snapshot| TS
    AIS -->|7. Save Result| SQ
```
\--------------------------------------------------------------------------------

### 3\. Fluxo Operacional Numerado (Ponta a Ponta)

**Handshake de Seleção:** O usuário clica no `StatusChip`. O `ConfigManager` valida as chaves em `credentials.json` e o menu popup exibe ícones ✅/❌\[4\]\[23\].

**Troca de Estado:** A seleção atualiza o `active_model` no `AppState`, que publica `MODEL_CHANGED` via PubSub\[24\]\[25\].

**Gatilho de Triage:** O usuário realiza um **Clique Duplo** na grade da Aba 2. O evento dispara a solicitação de resumo\[25\]\[26\].

**Pre-flight Check:** O `CostLedger` intercepta o pedido, calcula o custo estimado via `TokenEngine` e verifica se o limite da sessão foi atingido\[4\]\[27\].

**Execução Streaming:** Se autorizado, o `AIService` inicia o streaming. Fragmentos (chunks) são bufferizados no `SummaryPanel` (500ms/100chars) para evitar jitter visual\[8\]\[28\].

**Snapshot de Telemetria:** No encerramento, o `AIService` emite um objeto imutável `SummaryMeta`. A `TelemetryStrip` atualiza a UI com dados consistentes do ledger\[7\]\[29\].

**Persistência Transacional:** O custo real é registrado no `billing.db` e o resumo no `contextflow.db`\[14\]\[20\].

\--------------------------------------------------------------------------------

### 4\. Definição de Fronteiras e Contratos

**Contrato de Cores (ThemeManager):** Componentes de UI estão proibidos de usar hexadecimais. Eles devem invocar `ThemeManager.get_color(TOKEN_NAME)`\[11\]\[12\].

**Contrato de Telemetria (SummaryMeta):** A sincronia entre IA e UI é mediada exclusivamente por um objeto `dataclass(frozen=True)` contendo `request_id`, `tokens_used` e `latency_ms`\[7\]\[29\].

**Contrato de Isolamento:** A Aba 1 (Doca de Carga) permanece em layout estático. É proibido instanciar o `SummaryPanel` ou o `StatusChip` interativo dentro de `ui/tab_batch.py`\[30\]\[31\].

\--------------------------------------------------------------------------------

### 5\. Lista de Arquivos

| Status | Arquivos Impactados |
| --- | --- |
| PODEM ser alterados | core/app_state.py, core/config_manager.py, ui/app_window.py, ui/tab_analysis.py, ui/virtual_table.py, ui/panel_console.py[6][32]. |
| Arquivos NOVOS | core/cost_ledger.py, core/theme_manager.py, ui/components/status_chip.py, ui/components/telemetry_strip.py[6][14]. |
| NÃO PODEM ser alterados | storage/db_handler.py (Lógica de vídeos), services/youtube_manager.py, ui/tab_batch.py (Layout fixo)[30][31]. |

\--------------------------------------------------------------------------------

### 6\. Invariantes e Estratégias

**Invariante Sistêmico:** Nenhuma requisição à API externa pode ser disparada sem um registro prévio com status `PENDING` no `CostLedger`\[20\]\[33\].

**Estratégia de Concorrência:** O sistema impõe `max_workers=1` para o provedor **Ollama** via semáforo, independentemente do hardware, para preservar a responsividade da UI\[2\]\[34\].

**Estratégia Transacional:** Updates no `billing.db` utilizam o modo `WAL` (Write-Ahead Logging) do SQLite para permitir leituras de telemetria sem bloquear as escritas de custo\[20\].

**Política de Rollback:** Em caso de erro 429 ou falha de rede, o `CostLedger` marca a transação como `FAILED` com custo zero, liberando o orçamento da sessão para novas tentativas\[29\]\[35\].

\--------------------------------------------------------------------------------

**Veredito de Integridade:** Esta arquitetura blinda o ContextFlow contra a "Crise de Identidade de Classe" e garante que a Fase 6.1.1 converta dados em inteligência sem risco de insolvência financeira ou instabilidade de layout\[36\]\[37\].

**Deseja que eu gere o próximo arquivo,** `PHASE\_6\_1\_1\_TECH\_SPECS.md`**, detalhando o esquema do banco de dados e as assinaturas de métodos?**

### 🧑 **用户**

gere ## 3️⃣ PHASE\_6\_1\_1\_TECH\_SPECS.md

### 🤖 **助手**

# 3️⃣ PHASE\_6\_1\_1\_TECH\_SPECS.md

**Função:** Contrato técnico executável e determinístico para a **Fase 6.1.1**.

\--------------------------------------------------------------------------------

### 1\. Modelo de Dados Completo (Transacional)

O sistema opera com dois bancos de dados isolados para garantir que falhas analíticas não corrompam o registro financeiro soberano.

1.1. Banco de Governança (`billing.db`)

**Tabela:**`billing_events`Exclusiva para auditoria e controle de solvência\[1\]\[2\].

| Coluna | Tipo | Restrição | Descrição |
| --- | --- | --- | --- |
| timestamp | TEXT | NOT NULL | ISO8601 da transação. |
| request_id | TEXT | PRIMARY KEY | UUID único da chamada à API. |
| provider | TEXT | NOT NULL | Provedor (OpenAI, Gemini, etc). |
| model_id | TEXT | NOT NULL | ID técnico do modelo. |
| tokens_prompt | INTEGER | NOT NULL | Contagem real enviada. |
| tokens_completion | INTEGER | NOT NULL | Contagem real recebida. |
| cost_usd | REAL | NOT NULL | Custo calculado via CostEngine. |
| status | TEXT | NOT NULL | success, failed, fallback. |
| error_code | TEXT | NULLABLE | Código retornado pela API. |
| latency_ms | INTEGER | NOT NULL | Tempo total da operação. |

1.2. Banco de Conteúdo (`contextflow.db`)

**Tabela:**`summaries` (Relacionamento 1:1 com `videos`)\[3\].

| Coluna | Tipo | Descrição |
| --- | --- | --- |
| video_id | TEXT | PK/FK vinculado à tabela videos. |
| summary_text | TEXT | Conteúdo Markdown gerado. |
| prompt_hash | TEXT | SHA256(Texto + System Prompt) para cache. |
| model_used | TEXT | Nome do modelo para fins de exibição. |

\--------------------------------------------------------------------------------

### 2\. Estruturas Imutáveis (Data Contracts)

A comunicação entre o Motor de IA e a UI é mediada exclusivamente por snapshots congelados\[4\].

```
@dataclass(frozen=True)
class SummaryMeta:
    request_id: str
    provider: str
    model_id: str
    tokens_prompt: int
    tokens_completion: int
    estimated_cost: float
    latency_ms: int

@dataclass(frozen=True)
class TelemetrySnapshot:
    session_total_cost: float
    daily_burn_rate: float
    last_op_cost: float
    active_model_id: str
```
\--------------------------------------------------------------------------------

### 3\. Máquina de Estados do Seletor LLM

| Estado | Evento Gatilho | Ação do Sistema |
| --- | --- | --- |
| IDLE | Clique no StatusChip | Escaneia credentials.json via ConfigManager[5]. |
| VALIDATING | Seleção de Modelo | Realiza ping assíncrono de baixo custo (Health Check)[6]. |
| READY ✅ | Sucesso 200 | Atualiza AppState.active_model e emite MODEL_CHANGED. |
| INCOMPLETE ❌ | Chave Ausente | Desabilita item (item.Enable(False)) e gera tooltip. |
| ERROR ⚠️ | Falha 401/429 | Dispara SettingsDialog na aba de credenciais. |

**Estados Proibidos:**

Executar `AIService` com `active_model` em estado `INCOMPLETE`.

Persistir resumo sem um `request_id` validado pelo `CostLedger`.

\--------------------------------------------------------------------------------

### 4\. Requisitos Funcionais Numerados

**RF-01 (Seletor Agrupado):** O menu popup deve organizar modelos por `optgroup` (provedor). Modelos sem chave devem ser visualmente cinzas\[7\]\[8\].

**RF-02 (Expansão Master-Detail):** Vincular `EVT_GRID_CELL_LEFT_DCLICK` na `VirtualVideoTable` para disparar `SplitHorizontally` na Aba 2 \[Turno 21, 1811\].

**RF-03 (Light Mode Absoluto):** Injeção mandatária de CSS no `WebView` (`body { background: white !important; }`) e remoção de bordas pretas (#1E1E1E)\[9\]\[10\].

**RF-04 (CostLedger transacional):** Toda operação de IA deve utilizar `BEGIN IMMEDIATE` no SQLite para evitar erros de "Database is locked" em escritas massivas\[2\]\[11\].

**RF-05 (Telemetria Visual):** A `TelemetryStrip` deve exibir dinamicamente: `[ 🤖 Modelo | 🪙 Tokens | 💸 Custo Est. ]` no topo do `SummaryPanel`\[12\].

\--------------------------------------------------------------------------------

### 5\. Requisitos Não Funcionais (RNFs)

**RNF-01 (Performance de Renderização):** O `ThemeManager` deve prover tokens de cor em **< 1ms** via dicionário em memória\[12\].

**RNF-02 (Acurácia Financeira):** O desvio entre o custo estimado no "Pre-flight Check" e o registro final no ledger deve ser **< 2%**\[13\].

**RNF-03 (Segurança de Memória):** Encoders nativos (Anthropic/Gemini) devem ser carregados via **Lazy Loading** (apenas no primeiro uso do modelo correspondente) para manter RAM **< 250MB**\[8\]\[14\].

\--------------------------------------------------------------------------------

### 6\. Estratégia de Tratamento de Erros e Rollback

**Erro de Rate Limit (429):** O `CostLedger` marca a transação como `FAILED`, registra custo zero e dispara notificação de pausa para o `Processor`\[6\]\[15\].

**Erro de Custo (Excesso de Orçamento):** O sistema intercepta a chamada via `BudgetGuard` e impede o disparo da API antes de ocorrer a cobrança.

**Falha de WebView:** O `ThemeManager` deve garantir que o fallback para `wx.TextCtrl` mantenha as cores `COLOR_BG` (Branco) e `COLOR_FG` (Cinza)\[16\].

\--------------------------------------------------------------------------------

### 7\. Política de Persistência e Locking

**WAL Mode:** Ativação obrigatória de `PRAGMA journal_mode=WAL` no `billing.db` para permitir telemetria em tempo real sem bloquear escritas do ledger \[Turno 20\].

**Atomic Selection:** A troca de modelo via chip é salva instantaneamente no `user_settings.json` e persiste entre reinícios.

**Column Persistence:** Captura de `EVT_GRID_COL_SIZE` com gravação debounced (500ms) no JSON de preferências\[17\].

\--------------------------------------------------------------------------------

**Veredito de Blindagem:** Este documento remove a ambiguidade visual e financeira, estabelecendo as métricas exatas para a validação da **Fase 6.1.1**. Nenhuma implementação fora destes contratos será aceita.

### 🧑 **用户**

## 4️⃣ PHASE\_6\_1\_1\_STRUCTURAL\_STANDARDS.md

### 🤖 **助手**

\--------------------------------------------------------------------------------

# 4️⃣ PHASE\_6\_1\_1\_STRUCTURAL\_STANDARDS.md

**Função:** Blindagem contra dívida técnica, contratos de estilo e governança de dados para a **Fase 6.1.1**\[1\].

### 1\. Padrões Arquiteturais Adotados

**Arquitetura de Governança Financeira (CostLedger):** Implementação de um sistema transacional em SQLite (`billing.db`) que atua como barreira mandatória para qualquer requisição de IA\[2\].

**Gerenciamento Centralizado de Temas (ThemeManager):** Camada de abstração visual que fornece tokens de cor e CSS dinâmico, eliminando a definição direta de estilos nos componentes de UI\[5\].

**Protocolo Zero-Knowledge (Isolamento Total):** As abas funcionais permanecem fisicamente isoladas por arquivos, proibindo referências cruzadas e garantindo sincronia apenas via `AppState` e `PubSub`\[8\]\[9\].

### 2\. Design Patterns

**Permitidos:**

**Strategy Pattern:** Utilizado no `TokenEngine` para encapsular algoritmos específicos de cada provedor (Tiktoken, Anthropic, Gemini)\[9\]\[10\].

**Observer Pattern:** Aplicado no `StatusChip` para monitorar o estado das chaves de API e no `TelemetryStrip` para consumir snapshots de custo\[5\]\[9\].

**Factory Pattern:** Mantido no `AIService` para instanciar adaptadores LLM agnósticos em runtime\[9\]\[11\].

**Proibidos:**

**Singleton de UI:** Proibido instanciar componentes globais com estado interno que não derivem do `AppState`\[7\].

**Acesso Direto ao Banco:** Componentes de interface estão proibidos de executar queries SQL; o acesso deve ser mediado por serviços do Core\[12\].

### 3\. Regras de Modularização e Acoplamento

**Desacoplamento de UI:** Componentes reativos como `StatusChip` e `TelemetryStrip` devem residir exclusivamente em `ui/components/` para evitar a poluição de classes mestras\[9\].

**Injeção de Dependência:** Todo componente que necessite de estilização deve receber uma instância do `ThemeManager` no construtor, proibindo o uso de instâncias globais implícitas\[7\]\[13\].

**Acoplamento Zero:** A Aba 2 (Cockpit Analítico) não possui permissão técnica para importar ou instanciar qualquer elemento da Aba 1 (Doca de Carga)\[8\]\[9\].

### 4\. Estratégia de Logging e Auditoria

**Ledger Transacional:** Todo evento financeiro de IA deve ser registrado na tabela `billing_events` com `request_id` único, timestamp e status da operação\[3\].

**Diagnóstico Visual:** Mensagens de erro técnico devem ser reportadas no `ConsolePanel` com coloração sintática via `wx.TextAttr` para triagem rápida\[15\]\[16\].

**Auditoria de Integridade:** Validação mandatória de chaves de API via handshake assíncrono antes da população do menu de modelos\[17\]\[18\].

### 5\. Estratégia de Testes e Enforcement

**Stress de Ledger:** Execução obrigatória de 1.000 operações simuladas concorrentes para validar a ausência de deadlocks no SQLite e a consistência da soma total\[7\].

**Detecção de Violação Estrutural:** O script `verify_architecture.py` deve ser expandido para validar a regra de "no-circular-imports" entre as abas segregadas\[19\]\[20\].

**Enforcement de Estilo:** O Code Review deve barrar qualquer inclusão de cores hexadecimais hardcoded fora do arquivo de definição do `ThemeManager`\[12\]\[21\].

### 6\. Escopo Congelado Formal (Fase 6.1.1)

**Proibido:** Alteração de tabelas de conteúdo no banco `contextflow.db` além da tabela `summaries`\[22\]\[23\].

**Proibido:** Implementação de lógicas de busca vetorial, RAG ou chat interativo nesta sub-fase\[23\]\[24\].

**Proibido:** Modificar a Aba 1 (`ui/tab_batch.py`), que deve permanecer em layout estático e limpo\[8\]\[9\].

### 7\. Mecanismo de Proteção Estrutural

O sistema deve recusar o início do motor de IA se detectar uma divergência entre o custo exibido na UI e o saldo registrado no ledger transacional (Request Correlation)\[25\]\[26\].

\--------------------------------------------------------------------------------

**Garantia de Não Superficialidade:** Esta documentação blinda o ContextFlow contra a "Crise de Identidade" estrutural e garante que a evolução visual seja suportada por uma infraestrutura contábil imutável, consolidando o software como uma ferramenta industrial de elite\[21\]\[22\].

### 🧑 **用户**

## 5️⃣ PHASE\_6\_1\_1\_TRACEABILITY\_MATRIX.md

### 🤖 **助手**

# 5️⃣ PHASE\_6\_1\_1\_TRACEABILITY\_MATRIX.md

**Função:** Garantia de rastreabilidade e verificabilidade dos requisitos da Fase 6.1.1.

Esta matriz estabelece o vínculo mandatório entre os objetivos de negócio, as especificações técnicas e os protocolos de teste, garantindo que nenhum requisito funcional seja negligenciado ou implementado de forma ambígua\[1\]\[2\].

### Matriz de Rastreabilidade Operacional

| RF | Componente | Arquivo | Método | Teste que valida | Critério binário de aceite |
| --- | --- | --- | --- | --- | --- |
| RF-01 | Seletor Inteligente | ui/components/status_chip.py | populate_menu() | Manual: Handshake de Credenciais | Menu agrupa modelos e desabilita (Enable=False) itens com ícone ❌[3]. |
| RF-02 | Expansão por DClick | ui/tab_analysis.py | on_activate_item() | Manual: Gatilho de Cockpit | Clique duplo na grade dispara SplitHorizontally instantaneamente[4][5]. |
| RF-03 | Light Mode Absoluto | ui/tab_analysis.py | _apply_theme_css() | Visual: Saneamento Cromático | Ausência total de pixels escuros (#1E1E1E) e fundo branco no WebView[6]. |
| RF-04 | CostLedger Transacional | core/cost_ledger.py | record_transaction() | Stress: Integridade Financeira | Toda chamada de IA possui registro correspondente na tabela billing_events[7][8]. |
| RF-05 | Telemetria Visual | ui/components/telemetry_strip.py | update_snapshot() | Teste de Paridade UI/DB | Dados exibidos no topo do resumo coincidem 100% com o Ledger persistido[9][10]. |
| RF-06 | Persistência de Layout | ui/virtual_table.py | OnColSize() | Manual: Loop de Reinício | Largura da coluna configurada pelo usuário é restaurada após reabrir o app[11]. |
| RF-07 | Saneamento Visibilidade | ui/app_window.py | __init_toolbar() | Visual: Contraste Pro | Toggles de Console/Sidebar utilizam Bitmaps visíveis sobre fundo claro[12]. |

\--------------------------------------------------------------------------------

### Protocolo de Verificação de Integridade (Acceptance Criteria)

**Handshake de Credenciais:** O seletor de modelos deve recusar a seleção de qualquer provedor que não possua chave válida no `credentials.json`, disparando o diálogo de configurações caso o usuário tente forçar a ação\[13\].

**Imutabilidade Financeira:** O custo exibido na `TelemetryStrip` deve ser derivado exclusivamente do objeto `TelemetrySnapshot` (Fonte Única de Verdade), sendo proibido qualquer cálculo de valores dentro da camada de UI\[10\].

**Blindagem de Navegação (Anti-Jitter):** No modo de **Triagem Silenciosa**, a navegação por setas deve produzir zero movimento no `SplitterWindow`, preservando a área útil da grade até o comando manual\[6\].

**Consistência de Tema:** O sistema deve ser validado contra "vazamentos de estilo", onde componentes em fallback (ex: `wx.TextCtrl`) devem herdar obrigatoriamente as cores definidas pelo `ThemeManager`\[9\]\[14\].

\--------------------------------------------------------------------------------

**Garantia de Não Superficialidade:** Esta matriz remove a possibilidade de "funcionalidades fantasma". Se um componente não puder ser validado por um teste binário (Passa/Falha), sua implementação é considerada tecnicamente nula e passível de refatoração imediata para evitar dívida técnica na Fase 7\[2\]\[15\].

### 🧑 **用户**

## 6️⃣ PHASE\_6\_1\_1\_EXECUTION.md

### 🤖 **助手**

# 6️⃣ PHASE\_6\_1\_1\_EXECUTION.md

**Função:** Manual determinístico de implementação para a **Fase 6.1.1**.

Este roteiro define a sequência lógica e técnica para converter a arquitetura de governança e saneamento em código executável, garantindo que a **Lei da Estabilidade** não seja violada durante a transição\[1\]\[2\].

\--------------------------------------------------------------------------------

### 1\. Lista de Arquivos Impactados

| Status | Caminho do Arquivo | Responsabilidade |
| --- | --- | --- |
| NOVO | core/cost_ledger.py | Motor transacional de cobrança em SQLite (billing.db)[3]. |
| NOVO | core/theme_manager.py | Provedor central de tokens de cor e injeção de CSS[4]. |
| NOVO | ui/components/telemetry_strip.py | Widget de exibição de metadados financeiros imutáveis[5]. |
| MODIFICADO | core/app_state.py | Gestão de triage_mode e estados de budget[6][7]. |
| MODIFICADO | core/config_manager.py | Persistência de larguras de colunas e modelos ativos[8][9]. |
| MODIFICADO | ui/app_window.py | Realocação de botões de atalho e comando de maximização[10][11]. |
| MODIFICADO | ui/components/status_chip.py | Implementação do menu agrupado com handshake de chaves[12]. |
| MODIFICADO | ui/tab_analysis.py | Saneamento visual total e bind de clique duplo[13][14]. |
| MODIFICADO | ui/virtual_table.py | Alinhamento central global e listener de redimensionamento[15][16]. |

\--------------------------------------------------------------------------------

### 2\. Ordem Sequencial de Implementação

**Fundação Visual (ThemeManager):** Criar a classe que centraliza as cores `wx.WHITE` e `COLOR_FG` para eliminar o "dark mode residual" em fallbacks de UI\[4\]\[17\].

**Infraestrutura Transacional (CostLedger):** Implementar a tabela `billing_events` no `billing.db` e garantir o uso de `BEGIN IMMEDIATE` para evitar deadlocks de escrita\[3\]\[18\].

**Core de Governança:** Atualizar o `AIService` para exigir o `request_id` vindo do ledger antes de disparar qualquer streaming de texto\[19\].

**Saneamento do Cockpit (Aba 2):**

Binding do evento `EVT_GRID_CELL_LEFT_DCLICK` na grade para expansão manual\[20\]\[21\].

Injeção mandatária de CSS no WebView para forçar fundo branco\[22\]\[23\].

Centralização vertical/horizontal de todas as células via `GetAttr`\[24\].

**Componente Elite (StatusChip):** Refatorar o menu popup para iterar sobre os provedores do `ConfigManager`, cruzando com as chaves reais para aplicar ícones ✅/❌ e desabilitar modelos indisponíveis\[25\]\[26\].

**Persistência de Layout:** Vincular o `EVT_GRID_COL_SIZE` ao `ConfigManager` para salvar preferências de largura no `user_settings.json`\[27\]\[28\].

**Dashboard de Telemetria:** Integrar a `TelemetryStrip` no topo do `SummaryPanel`, assinando o tópico PubSub `SUMMARY_META_UPDATED`\[5\]\[29\].

\--------------------------------------------------------------------------------

### 3\. Pseudocódigo das Partes Críticas

3.1. Handshake do Seletor Inteligente (`ui/components/status_chip.py`)

```
def OnClick(self, event):
    menu = wx.Menu()
    providers = self.config.get_all_providers() # Ex: OpenAI, Anthropic, Ollama
    for p in providers:
        menu.AppendSeparator()
        for model in p.models:
            has_key = self.config.check_key_exists(p.name)
            icon = "✅ " if has_key else "❌ "
            item = menu.Append(wx.ID_ANY, f"{icon}{model.name}")
            if not has_key: 
                item.Enable(False) # Bloqueia seleção sem chave
                item.SetHelp("Configure a chave de API nas Configurações")
    self.PopupMenu(menu)
```

3.2. Expansão Master-Detail por DClick (`ui/tab_analysis.py`)

```
def on_grid_dclick(self, event):
    row = event.GetRow()
    video_id = self.grid.Table.get_id_at(row)
    if not self.splitter.IsSplit():
        self.splitter.SplitHorizontally(self.grid, self.summary_panel)
    PubSub.publish('REQUEST_SUMMARY', video_id=video_id)
    event.Skip()
```
\--------------------------------------------------------------------------------

### 4\. Plano de Migração e Rollback

**Migração de Dados:** Na primeira execução, o sistema deve detectar a ausência do `billing.db` e criá-lo automaticamente com a tabela de auditoria. Não há necessidade de migrar dados da tabela `summaries` atual\[30\]\[31\].

**Rollback Completo:** Caso o ledger cause latência excessiva (over-head de disco), o sistema permite o downgrade para a v36 deletando os novos arquivos de componente (`telemetry_strip.py`) e restaurando os arquivos `ui/` originais do backup\[32\]\[33\].

\--------------------------------------------------------------------------------

### 5\. Testes Obrigatórios e Critérios de Aceite (Gherkin)

Cenário: Triagem Silenciosa (Anti-Jitter)

**Dado** que o Modo de **Triagem Silenciosa** está ATIVO.

**Quando** eu uso as setas do teclado para navegar rapidamente pela grade.

**Então** o painel de resumo inferior deve permanecer fechado (Unsplit)\[34\]\[35\].

**E** quando eu dou um **Clique Duplo** em um item, o painel deve abrir e carregar o resumo instantaneamente\[23\]\[36\].

Cenário: Governança de Chaves no Chip

**Dado** que a chave da Anthropic está vazia no `credentials.json`.

**Quando** eu clico no **StatusChip** para trocar o modelo.

**Então** os modelos "Claude-..." devem exibir o ícone ❌ e estar desabilitados para clique\[12\]\[26\].

\--------------------------------------------------------------------------------

**Garantia de Não Superficialidade:** Este manual elimina o risco de "implementação teatral" onde indicadores financeiros existem mas não são auditados. A execução aqui descrita blinda o ContextFlow como uma ferramenta industrial profissional\[37\]\[38\].