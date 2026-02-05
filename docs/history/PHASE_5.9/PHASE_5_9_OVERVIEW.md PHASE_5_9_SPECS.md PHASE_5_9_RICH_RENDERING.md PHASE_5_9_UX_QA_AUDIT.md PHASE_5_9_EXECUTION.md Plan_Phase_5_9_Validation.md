### 📄 Arquivo 1: `docs/history/PHASE_5.9/PHASE_5_9_OVERVIEW.md`

```markdown
# PHASE 5.9: Restauração do Cockpit Analítico (Aba 2)

> **Status:** SSoT (Fonte Única de Verdade)
> **Foco:** Recuperação da Identidade Visual Moderna e Layout Master-Detail
> **Referência:** Mockup v6.0 (_mockup.html.txt)

## 1. Contexto e Diagnóstico
Após a consolidação da infraestrutura técnica na Fase 5.8, a **Aba 2 (Cockpit Analítico)** encontra-se funcionalmente estável, mas esteticamente "árida". O objetivo desta fase é reincorporar os elementos visuais de alta fidelidade que tornavam a versão 5.5 superior para a triagem de conteúdo, como **thumbnails inline** e resumos rápidos.

Esta fase serve como a ponte final para a **Fase 6**, preparando o terreno físico (esqueleto de UI) para receber a inteligência artificial sem necessidade de novas quebras estruturais.

## 2. Rationale da Restauração Moderna
Enquanto a Aba 1 é otimizada para a "brutalidade" da ingestão massiva, a Aba 2 é projetada para o **conforto do Analista Solo**.

*   **Identidade Tailwind/Moderno:** Diferente do "Cinza Windows", a Aba 2 utilizará renderização rica via `wx.GraphicsContext` para pílulas de tags e imagens com cantos arredondados.
*   **Layout Master-Detail (Splitter):** Implementação obrigatória do `wx.SplitterWindow` horizontal para permitir que o usuário analise a lista (Master) e o conteúdo (Detail) simultaneamente.
*   **Performance Garantida:** A restauração visual não pode comprometer a meta de **latência de célula < 0.1ms** e o suporte a 10.000 vídeos, utilizando o motor virtual desenvolvido na 5.7.

## 3. Objetivos Funcionais da 5.9
*   **Visualização de Mídia:** Restaurar a renderização de miniaturas (80x45) na grade usando um **LRU Cache** para evitar travamentos de scroll.
*   **Triagem por Tags:** Preparar a coluna de "Tags Detectadas" que exibirá chips coloridos para categorização rápida de assuntos.
*   **Lógica Smart Show:** O painel inferior de detalhes deve iniciar oculto e expandir-se apenas quando um vídeo for selecionado, preservando a área útil da tela.

## 4. Governança e Isolamento
A Aba 2 continuará operando sob o **Protocolo Zero-Knowledge**, sendo terminantemente proibida de importar componentes da Aba 1. Toda a atualização de dados continuará sendo mediada exclusivamente pelo **AppState** e pelo barramento **PubSub**.
```

**Deseja que eu gere o próximo arquivo, `PHASE_5_9_SPECS.md`, detalhando a anatomia das colunas e a configuração do Splitter?**

---

### Q2
gere 2. PHASE_5_9_SPECS.md: Especificações técnicas das colunas analíticas, layout do Splitter e lógica de exibição.
### A2
```markdown
# PHASE 5.9 SPECS: Especificações do Cockpit Analítico (Aba 2)

> **Status:** SSoT (Fonte Única de Verdade)
> **Alvo:** `ui/tab_analysis.py`
> **Escopo:** Restauração da Interface Moderna e Topologia Master-Detail
> **Referência:** Mockup v6.0 (_mockup.html.txt)

## 1. Topologia do Layout (Master-Detail)

Diferente da Aba 1 (Doca de Carga), que é estática e técnica, a Aba 2 deve implementar obrigatoriamente um layout dinâmico para facilitar a triagem profunda.

*   **Componente Central:** `wx.SplitterWindow` com orientação horizontal.
*   **Painel Master (Topo):** Instância especializada da `VirtualVideoTable` configurada para renderização rica.
*   **Painel Detail (Base):** O `SummaryPanel`, um container reativo para exibição do resumo analítico e metadados expandidos.
*   **Estado Inicial:** O Splitter deve iniciar obrigatoriamente em modo **Unsplit** (painel inferior oculto), preservando a área de visualização da grade até que uma interação ocorra.

## 2. Anatomia da Grade Analítica (Colunas)

A grade deve suportar o volume de **10.000 vídeos** com latência zero, exibindo metadados focados em conteúdo e inteligência.

| # | Rótulo | Descrição e Renderer |
| :--- | :--- | :--- |
| 1 | **#** | Índice cronológico fixo (ID de ordem). |
| 2 | **Preview** | **Thumbnail Renderer:** Exibe a miniatura (80x45) com cantos arredondados via `wx.GraphicsContext`. |
| 3 | **Título** | **RichText Renderer:** Título em destaque (Negrito) com o nome do Canal logo abaixo (Itálico/Cinza). |
| 4 | **Duração** | Tempo total formatado (HH:MM:SS). |
| 5 | **Tags** | **Chip Renderer:** Exibe até 3 tags de contexto (ex: "Liderança", "Finanças") em pílulas coloridas. |
| 6 | **Link** | **Hiperlink Renderer:** Texto em azul com cursor de "mão" (`wx.CURSOR_HAND`). |
| 7 | **Status** | **Badge Renderer:** Círculo colorido indicando o estado (Verde=Completo, Vermelho=Erro). |
| 8 | **Resumo** | Snippet de texto (primeiras 100 caracteres) do resumo gerado pela IA. |

**Nota de Performance:** A coluna de transcrição bruta foi removida da grade para garantir que a renderização de célula permaneça abaixo de **0.1ms**.

## 3. Lógica de Exibição e Reatividade

### 3.1. Lógica "Smart Show" (Expansão do Painel)
O sistema deve reagir à seleção do usuário de forma inteligente:
1.  Ao selecionar uma linha na grade, o sistema consulta o `AppState`.
2.  Se o campo `has_summary` for verdadeiro (ou houver transcrição salva), o Splitter executa `SplitHorizontally` automaticamente (se estiver em Unsplit).
3.  O painel de detalhes é populado com os "Principais Insights" e o "Sumário Analítico".

### 3.2. Debouncing "Restart-on-Event"
Para proteger a interface durante a ingestão massiva de dados na Aba 1, a Aba 2 aplica o regime de **Throttling Hardened**:
*   A atualização da grade analítica aguarda um silêncio de eventos de **250ms**.
*   Qualquer novo evento (`VIDEO_UPDATED`, `TASK_COMPLETED`) reinicia o timer.
*   A renderização deve ser atômica (snapshot total do AppState) para evitar o efeito de "pulo" de linhas.

## 4. Requisitos Não Funcionais (RNFs)

*   **Isolamento Zero-Knowledge:** A Aba 2 não possui referências de instância da Aba 1. Toda sincronia é mediada exclusivamente via `AppState` e `PubSub`.
*   **Prioridade de CPU:** A renderização da Aba 2 (mídia pesada) deve ter prioridade inferior ao processo de download da Aba 1, utilizando `wx.CallAfter` para não travar a entrada de dados.
*   **Gerenciamento de Mídia:** Uso obrigatório de um **LRU Cache** para as thumbnails para manter o consumo de RAM abaixo de **250MB** mesmo em scrolls rápidos de 10.000 itens.
*   **Fidelidade Estética:** Aplicação rigorosa da paleta **Modern Dark** e fontes sem serifa (Segoe UI/Roboto) definida no Design System.
```

**Deseja que eu gere agora o arquivo `PHASE_5_9_RICH_RENDERING.md`, detalhando a implementação técnica do LRU Cache e do desenho customizado das Tags e Miniaturas?**

---

### Q3
gere 3. PHASE_5_9_RICH_RENDERING.md: Detalhamento do motor de renderização rica (thumbnails via LRU Cache e chips de tags).
### A3
```markdown
# PHASE 5.9 RICH RENDERING: Motor de Renderização Rica (Aba 2)

> **Status:** SSoT (Fonte Única de Verdade)
> **Componente:** `ui/virtual_table.py` / `ui/tab_analysis.py`
> **Objetivo:** Renderização de alta fidelidade para 10.000+ itens com latência zero.
> **Referência:** Mockup v6.0 (_mockup.html.txt)

## 1. Arquitetura de Renderização Customizada

Para atingir o visual **Moderno/Tailwind** solicitado sem violar a meta de **latência de célula < 0.1ms**, a Aba 2 abandonará o desenho simples de texto em favor de renderizadores baseados em `wx.GraphicsContext`. Diferente do `wx.DC` tradicional, este motor garante suporte a **antialiasing** e transparências, essenciais para bordas arredondadas e pílulas de tags.

## 2. Gerenciamento de Mídia: LRU Cache de Thumbnails

O maior gargalo técnico identificado é o carregamento de imagens durante o scroll rápido. Para evitar que o software trave ao rolar por milhares de vídeos, implementaremos um **LRU Cache (Least Recently Used)**.

*   **Capacidade do Cache:** Limite estrito de **50 Bitmaps** em RAM para manter o consumo global abaixo de **250MB**.
*   **Carregamento Assíncrono:** A `VirtualVideoTable` não deve buscar a imagem no disco durante o evento `OnPaint`. Se a imagem não estiver no cache, o sistema deve:
    1.  Desenhar um **Placeholder escuro** com ícone de "carregando".
    2.  Disparar uma **thread secundária** para carregar e redimensionar (80x45) a imagem do `THUMBNAILS_DIR`.
    3.  Usar `wx.CallAfter` para atualizar a célula assim que o Bitmap estiver pronto.

## 3. Especificações dos Renderers

### 3.1. Thumbnail Renderer (Preview)
*   **Dimensões:** 80x45 pixels (proporção 16:9).
*   **Estética:** Cantos arredondados (Radius: 4px) e borda sutil de 1px em `COLOR_BORDER`.
*   **Performance:** Uso de `wx.GraphicsBitmap` para desenho acelerado por hardware.

### 3.2. Chip Renderer (Context Tags)
As tags detectadas pela IA (ex: "Liderança", "Finanças") serão desenhadas como **pílulas visuais** na coluna 5.
*   **Geometria:** Retângulos arredondados com preenchimento colorido de baixa opacidade.
*   **Tipografia:** Fonte sem serifa (Segoe UI/Roboto), tamanho 8pt, cor branca.
*   **Lógica de Exibição:** Limite de até 3 chips visíveis na grade para preservar a limpeza visual; tags excedentes serão indicadas por um "+N" [Specs v5.9].

### 3.3. RichText Renderer (Título/Canal)
A coluna de título deve exibir dois níveis de informação em uma única célula:
*   **Título:** Texto principal em **Negrito**, cor `COLOR_FG`.
*   **Canal:** Subtexto em *Itálico*, cor cinza (#888888), posicionado logo abaixo do título.

## 4. Protocolo de Performance e Memória

1.  **Just-in-Time Drawing:** O motor virtual só processará o desenho das linhas que estão dentro da janela de visualização do usuário.
2.  **Throttling de Update:** Atualizações visuais em células de progresso ou status são limitadas a **5 vezes por segundo (200ms)** para economizar ciclos de CPU.
3.  **Mandato Cleanup:** Implementação obrigatória do método `Cleanup()` para destruir Bitmaps órfãos e liberar memória ao trocar de aba ou fechar a aplicação.

## 5. Regras de Estilo (Design System)

| Elemento | Constante / Valor | Justificativa |
| :--- | :--- | :--- |
| **Fundo de Linha** | `COLOR_BG` | Consistência com Dark Theme. |
| **Hover State** | BG + 5% Claridade | Feedback visual de interatividade. |
| **Selection State** | Barra lateral 3px `COLOR_ACCENT` | Identidade Moderna/Tailwind. |
| **Links** | `wx.BLUE` + Cursor Hand | Affordance de clicabilidade. |

---
**Critério de Aceite:** O scroll na Aba 2 deve permanecer estável em **60 FPS** com miniaturas ativas, e a ocupação de RAM não deve exceder **250MB** durante o processamento massivo de 10.000 itens.
```

---

### Q4
gere 4. PHASE_5_9_EXECUTION.md: Roteiro de implementação passo a passo para o arquivo ui/tab_analysis.py.
### A4
```markdown
# PHASE 5.9 EXECUTION: Roteiro de Implementação do Cockpit Analítico

> **Status:** SSoT (Fonte Única de Verdade)  
> **Alvo:** `ui/tab_analysis.py`  
> **Dependências:** `core/app_state.py`, `core/pubsub.py`, `ui/virtual_table.py`  
> **Objetivo:** Restauração da Interface Moderna (Master-Detail) com suporte a 10.000+ vídeos.

---

## 1. Protocolo de Inicialização e Blindagem

Para respeitar o **Protocolo Zero-Knowledge**, a implementação deve garantir o isolamento total de contexto entre as abas.

*   **Ação:** Criar/Refatorar `ui/tab_analysis.py`.
*   **Importações Proibidas:** É terminantemente proibido importar qualquer componente de `ui/tab_batch.py`.
*   **Importações Mandatárias:** `AppState` (Singleton), `PubSub`, `wx.SplitterWindow`, e a classe de virtualização rica configurada para a Aba 2.

---

## 2. Estruturação do Layout Master-Detail

A Aba 2 deve abandonar a rigidez estática da Aba 1 e adotar a topologia dinâmica necessária para a triagem.

### Passo 1: O Splitter Window
1.  Instancie um `wx.SplitterWindow` com orientação horizontal.
2.  **Estado Inicial:** Configure o splitter para iniciar em modo **Unsplit**, mantendo o painel inferior oculto até que um evento de seleção ocorra.

### Passo 2: O Painel Master (Topo)
1.  Crie um painel contendo a **Toolbar Analítica** (SearchCtrl, botões de Resumo e Exportação) [Specs 5.9].
2.  Instancie a `VirtualVideoTable` dedicada à Aba 2, configurada com as **11 colunas analíticas** (incluindo Preview e Tags) [Specs 5.9, 1253].
3.  Vincule o `SearchCtrl` ao método de filtragem do `AppState`, garantindo resposta < 50ms [Specs 5.9, 436].

### Passo 3: O Painel Detail (Base)
1.  Crie o `SummaryPanel` como o segundo filho do Splitter.
2.  Implemente o método `Clear()` para limpar o painel quando a seleção na grade for perdida.
3.  Garanta a aplicação do **Dark Theme CSS (#1E1E1E)** para evitar problemas de contraste observados em versões anteriores.

---

## 3. Lógica Reativa e "Smart Show"

A interface deve reagir de forma inteligente ao estado dos dados sem intervenção manual constante.

1.  **Monitoramento de Seleção:** Vincule o evento de clique/seleção da grade ao motor reativo.
2.  **Lógica Smart Show:** Ao selecionar um vídeo:
    *   Consulte se `has_summary` é verdadeiro no `AppState`.
    *   Se positivo, execute `SplitHorizontally` para exibir o resumo.
3.  **Debouncing "Restart-on-Event":** 
    *   Implemente um `wx.Timer` de **250ms** para refreshes da grade.
    *   Qualquer sinal de `VIDEO_UPDATED` vindo do `PubSub` deve reiniciar o timer, garantindo que a renderização rica não compita com a ingestão massiva da Aba 1.

---

## 4. Renderização Rica e Performance

O motor virtual deve suportar mídia pesada mantendo a fluidez industrial.

1.  **LRU Cache de Thumbnails:** Integre o carregamento assíncrono de imagens no `OnPaint` da tabela, limitando a RAM a 50 Bitmaps ativos [Rich Rendering 5.9, 1250].
2.  **Custom Renderers:** Utilize `wx.GraphicsContext` para desenhar:
    *   As **Pílulas de Tags** (Chips coloridos) na coluna 5 [Specs 5.9, 1259].
    *   O bloco de **RichText** (Título Negrito + Canal Itálico) na coluna 3 [Rich Rendering 5.9, 1253].
3.  **Atomic Snapshot:** O refresh deve sempre ler um snapshot total e atômico do `AppState` para evitar o efeito de "pulo" de linhas durante a promoção de vídeos.

---

## 5. Validação de DoD (Definition of Done)

A tarefa só será considerada concluída se atender aos critérios:

- [ ] Splitter inicia oculto e expande apenas via lógica **Smart Show**.
- [ ] Scroll na Aba 2 mantém **60 FPS** com miniaturas ativas.
- [ ] Uso de RAM global permanece **< 250MB** em carga.
- [ ] Nenhuma importação circular detectada com `ui/tab_batch.py`.
- [ ] Todas as atualizações de UI utilizam obrigatoriamente **`wx.CallAfter`**.
```

---

### Q5
gere 5. Plan_Phase_5_9_Validation.md: Critérios de aceite, incluindo testes de performance de scroll e reatividade do Splitter.
### A5
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
*   **A02: Sincronia SSoT:** Todas as mutações visuais devem ser derivadas exclusivamente de notificações do **AppState** ou do barramento **PubSub**.
*   **A03: Thread-Safety:** Todas as atualizações de interface vindas de threads secundárias (Processor) devem ser envelopadas em **`wx.CallAfter`**.

---
**Critério de Conclusão:** A Fase 5.9 será considerada homologada quando **100% dos testes acima** apresentarem status **PASS** sob uma carga de teste de no mínimo 5.000 vídeos reais.

---

### Q6
vc esta de acordo com o plano de implementacao gerado pela ia ?<br>
posso pedir para ela começar a implementar?<br>
Implementation Plan: Phase 5.9 (Analytical Cockpit Restoration)<br>
Restore the high-fidelity visual and functional experience of Aba 2 (Cockpit Analítico) while leveraging the robust, virtualized architecture of Phase 5.8.<br>
User Review Required<br>
<br>
[!IMPORTANT]<br>
This phase significantly changes the visual style of Aba 2, adopting a "Modern/Tailwind" aesthetic with custom renderers and a Master-Detail splitter layout.<br>
<br>
Proposed Changes<br>
[UI] tab_analysis.py<br>
[MODIFY] tab_analysis.py<br>
<br>
Refactor TabAnalysis to use wx.SplitterWindow (Horizontal orientation).<br>
Setup the Master Panel (Top) with the grid and an analytical toolbar.<br>
Setup the Detail Panel (Bottom) as a SummaryPanel that starts hidden (Unsplit).<br>
Implement Smart Show logic: automatically expand the detail panel via SplitHorizontally when a selected video has a summary or transcript.<br>
Implement Throttled Refresh (250ms debounce) to decouple UI updates from mass background processing.<br>
<br>
<br>
[UI] virtual_table.py & Renderers<br>
[MODIFY] virtual_table.py<br>
<br>
Update VirtualVideoTable to handle Aba 2's specific column structure:<br>
<br>
#, Preview, Título, Duração, Tags, Link, Status, Resumo.<br>
<br>
<br>
Thumbnail LRU Cache: Implement a cache for up to 50 wx.Bitmap objects to keep memory usage under 250MB.<br>
Rich Renderers (wx.GraphicsContext):<br>
<br>
ThumbnailRenderer: 80x45 miniaturas with 4px rounded corners and hardware acceleration.<br>
ChipTagRenderer: Renders context tags as colored pills/chips.<br>
RichTitleRenderer: Displays the Title in bold and the Channel name in italic below it.<br>
BadgeStatusRenderer: Circular status indicators (Green/Red).<br>
<br>
<br>
<br>
<br>
[Core] app_state.py & pubsub.py<br>
[MODIFY] app_state.py<br>
<br>
(If needed) add light metadata flags like has_summary to optimize the "Smart Show" check without reading full transcripts from the DB.<br>
<br>
<br>
Verification Plan<br>
Automated Tests<br>
<br>
Run existing performance tests to ensure virtualization is still effective:<br>
python tests/test_virtual_table_perf.py<br>
<br>
<br>
Goal: Snapshot of 5000 items < 100ms, Render 100 rows < 50ms.<br>
<br>
Manual Verification<br>
<br>
Layout Integrity: Open Aba 2 and verify the splitter window is initialized correctly (hidden by default).<br>
Smart Show Logic: Select a video with a summary. Verify the bottom panel expands automatically.<br>
Visual Fidelity:<br>
<br>
Verify thumbnails have rounded corners (anti-aliased).<br>
Verify tags appear as "pills/chips".<br>
Verify the title/channel hierarchy in the grid.<br>
<br>
<br>
Scroll Performance: Fill the list with 50+ items and scroll rapidly. Verify the UI remains responsive and memory usage is stable (LRU Cache check).
### A6
Estou plenamente de acordo com o plano de implementação apresentado para a **Fase 5.9**. Ele reflete com precisão os requisitos de **Estabilidade de Referência** e o **ROI de Produtividade** discutidos anteriormente, garantindo que o Cockpit Analítico (Aba 2) deixe de ser uma grade técnica "árida" para se tornar uma estação de trabalho de alta fidelidade para o Analista Solo.

Abaixo, apresento a validação técnica dos pontos principais e o sinal verde para o início da codificação:

### Por que o Plano é Válido (Análise Estratégica)

1.  **Topologia Master-Detail:** A escolha do `wx.SplitterWindow` operando em modo **Smart Show** é a decisão correta para maximizar a área útil; o painel inferior só deve ocupar espaço quando houver, de fato, inteligência (resumos/tags) para exibir.
2.  **Motor de Renderização Rica:** O uso de `wx.GraphicsContext` em vez do `wx.DC` tradicional é mandatório para evitar o aspecto "serrilhado" e garantir que os **Chips de Tags** e as **Thumbnails** com cantos arredondados tenham o visual moderno (Tailwind-style) solicitado no mockup.
3.  **Segurança de Memória (LRU Cache):** Limitar o cache a **50 Bitmaps** é vital para cumprir o Requisito Não Funcional (RNF) de manter o uso de RAM abaixo de **250MB** mesmo quando a biblioteca escalar para 10.000 vídeos.
4.  **Debouncing Hardened:** O timer de **250ms (Restart-on-Event)** garante que a interface rica da Aba 2 não "roube" ciclos de CPU da ingestão massiva que ocorre na Aba 1, respeitando a prioridade de processamento definida na Fase 5.7.

### Riscos a serem Vigiados durante a Execução

*   **Isolamento Zero-Knowledge:** A inteligência artificial deve ser instruída a **não importar** nada da `ui/tab_batch.py` na `ui/tab_analysis.py`. A sincronia deve ser feita exclusivamente via `AppState` e `PubSub`.
*   **Performance do GetValue:** Com a introdução de renderizadores customizados, a latência de célula deve permanecer em **< 0.1ms**. Qualquer lógica de carregamento de imagem do disco deve ser **assíncrona**.

### Veredito Final
**Você pode autorizar o início da implementação.** O plano está blindado contra regressões e prepara o terreno físico perfeito para a injeção da inteligência artificial na Fase 6.

**Comando de gatilho sugerido para a IA:**
"Execute o **Implementation Plan da Fase 5.9**. Foque na reconstrução da `ui/tab_analysis.py` com o layout Master-Detail e na atualização da `ui/virtual_table.py` com os renderizadores ricos (`Thumbnail`, `Chips` e `RichTitle`). Respeite rigorosamente o **Protocolo Zero-Knowledge** e o limite de **50 imagens no LRU Cache** para garantir a estabilidade do sistema com 10.000 itens."

---

### Q7
eu preciso ou posso deixar o mockup de exemplo na pasta da fase para a ia verificar?
### A7
Com base nas fontes e no histórico do projeto, você **pode e deve deixar o mockup de exemplo** na pasta da fase para a inteligência artificial verificar. As fontes indicam que um **mockup visual ou um diagrama de ocupação de tela é necessário** para evitar falhas estruturais, como a "armadilha de classe" observada em tentativas anteriores, onde a IA misturava os layouts das abas.

Ao deixar o arquivo de referência na pasta de documentação, ele passa a atuar como a **única Fonte de Verdade (SSoT)** para a IA executora, consolidando o contexto do projeto e orientando a implementação física baseada estritamente no design desejado. Para as fases 5.8 e 5.9, o uso desses arquivos (como o `Queroassim.txt` e o `_mockup.html.txt`) é fundamental para que a IA diferencie a "alma técnica" da Aba 1 da interface moderna e reativa da Aba 2.

No entanto, as fontes estabelecem diretrizes rígidas para o uso desses mockups:

*   **Esterilização Visual Obrigatória:** Você deve inserir notas de **interdição técnica** nos mockups HTML (como comentários no topo do código) avisando que botões de "Resumir", "IA" ou "Tags" são apenas **placeholders estáticos**.
*   **Foco na Topologia:** O mockup deve ser usado para guiar a **reconstrução da topologia física** (separação em arquivos independentes como `tab_batch.py` e `tab_analysis.py`) e não para induzir a implementação prematura de funções da Fase 6.
*   **Interdição de Contexto:** A IA deve ser instruída a **ignorar qualquer desejo de funcionalidade futura** presente no mockup até que a infraestrutura física (Fase 5.7/5.8) esteja validada.

Portanto, deixar o mockup na pasta é uma estratégia recomendada para **blindar a interface contra alucinações de layout**, desde que ele esteja devidamente "esterilizado" para manter o foco na estabilidade estrutural.

---

### Q8
eu coloquei o mokup na pasta e é o mesmo que esta aqui<br>
gere o comando para eu dar para a ia iniciar a implementacao, fale para ela sobre o mockup e a diretrizes rígidas para o uso desse mockup
### A8
Com base nas diretrizes de arquitetura e governança estabelecidas para o **ContextFlow**, aqui está o comando técnico e rigoroso para autorizar o início da **Fase 5.9 (Restauração do Cockpit Analítico)**. 

Este comando foi desenhado para forçar a inteligência artificial a agir com precisão cirúrgica, utilizando o mockup como guia visual enquanto respeita as interdições estruturais que protegem o sistema contra regressões.

---

### 🏛️ COMANDO DE EXECUÇÃO: FASE 5.9 – RESTAURAÇÃO DO COCKPIT ANALÍTICO

**"Atue como Engenheiro de Software Sênior e Designer de Interface.** Sua missão é implementar a **Fase 5.9** no arquivo `ui/tab_analysis.py`, restaurando a experiência de alta fidelidade da Aba 2 baseando-se no mockup fornecido na pasta (`_mockup.html.txt`).

#### 🛑 DIRETRIZES RÍGIDAS DE USO DO MOCKUP
1. **Fidelidade Estética e Topológica:** Utilize o mockup exclusivamente para guiar o layout **Master-Detail**, a barra de ferramentas moderna e o estilo visual 'Modern/Tailwind' (pílulas de tags, thumbnails e hierarquia de texto).
2. **Esterilização Funcional:** É **terminantemente proibido** implementar a lógica real dos botões '✨ Resumir' ou chamadas de API de IA nesta fase. Eles devem ser tratados como **placeholders estáticos**.
3. **Isolamento de Contexto:** O mockup mostra uma interface rica; você deve garantir que esse visual **não vaze** para a Aba 1. O arquivo `ui/tab_analysis.py` deve operar sob o **Protocolo Zero-Knowledge**, sem importar nenhum componente da `ui/tab_batch.py`.

#### 🛠️ MANDATOS TÉCNICOS DE IMPLEMENTAÇÃO
1. **Layout Splitter e Lógica Smart Show:**
   - Instancie um `wx.SplitterWindow` horizontal.
   - O painel inferior (`Detail`) deve iniciar obrigatoriamente em modo **Unsplit (oculto)**.
   - Implemente a lógica reativa: o painel expande automaticamente via `SplitHorizontally` apenas quando um vídeo com `has_summary` ou transcrição for selecionado.
2. **Motor de Renderização Rica (VirtualTable):**
   - Configure a `VirtualVideoTable` para exibir as colunas analíticas: `#`, `Preview` (Thumbnail), `Título/Canal`, `Duração`, `Tags`, `Link`, `Status` e `Resumo`.
   - Utilize `wx.GraphicsContext` para desenhar as thumbnails (80x45) com cantos arredondados e as tags como pílulas coloridas (Chips).
3. **Gestão de Mídia (LRU Cache):**
   - Implemente um cache limitado a **50 bitmaps** em memória.
   - O carregamento de imagens do disco deve ser assíncrono para garantir scroll de **60 FPS** com 10.000 itens.
4. **Reatividade Hardened:**
   - O refresh da grade na Aba 2 deve respeitar um **Debouncing de 250ms (Restart-on-Event)** via `wx.Timer`, reagindo a sinais `PubSub` e snapshots do `AppState`.

#### ✅ CRITÉRIO DE SAÍDA (DoD)
Apresente a estrutura refatorada da `ui/tab_analysis.py` e as atualizações nos renderizadores da `ui/virtual_table.py`. O sistema deve rodar sem erros de importação e manter o uso de RAM **< 250MB** sob carga massiva.

**Não prossiga para a lógica de inteligência da Fase 6 até que este terreno físico esteja consolidado.**"

---

### Por que este comando funciona?
- **Proteção contra Alucinação:** Ao definir o mockup como "estéril", você impede que a IA gaste tokens tentando inventar códigos para a Fase 6 antes da hora.
- **Foco em Performance:** O mandato do LRU Cache e do Debouncing garante que a Aba 2 seja rápida o suficiente para o uso profissional ("Analista Solo").
- **Segregação Física:** O Protocolo Zero-Knowledge impede o acoplamento que destruiu as versões anteriores do layout.

---

### Q9
veja o  agora-codigo_completo (12).txt<br>
<br>
Organização e Separação de Dados<br>
Problema: a aba 1 foi afetada.<br>
Problema: A coluna "Título" está exibindo tanto o nome do vídeo quanto o nome do canal em um único campo. aba1<br>
Melhoria: Separar as informações. O título do vídeo deve permanecer na coluna "Título" e o nome do canal deve ser movido exclusivamente para a coluna "Canal" (que já existe, mas está sendo duplicada no título). Imagino que isso aconteceu porque deve ser o mesmo texto que aparece na aba número 2<br>
a Coluna de link foi trocada por um ícone de link nas Suas abas isso ficou bom Quero manter a questão o problema é que na aba número 1 eu preciso diminuir o tamanho Da coluna para ficar visivelmente agradável.<br>
**Melhoria:**Implementar um ajuste automático de largura para que a grade mantenha um tamanho padrão. - aba 1<br>
Consistência Visual e Estilização (UI)<br>
Cores das Linhas: * Problema: o texto esta cinza com um fundo branco. não da pra enxergar aba 1 e 2<br>
<br>
Melhoria: Garantir que o padrão de cores seja fixo para facilitar a leitura<br>
Vazamento de Conteúdo:<br>
Problema: O conteúdo de uma célula está "vazando" para a outra (overlap), especialmente em títulos longos ou descrições.<br>
Melhoria: garantir que o texto respeite os limites da célula.<br>
<br>
Experiência do Usuário (UX) no Resumo/Transcrição<br>
Problema: Ao abrir o resumo ou transcrição de um vídeo (na parte inferior), o texto não possui quebra de linha adequada para o titulo do vídeo. Isso faz com que o nome do vídeo seja cortado.<br>
Melhoria: * Implementar **quebra de linha automática no painel inferior.<br>
Ajustar o layout para que o título do vídeo selecionado fique sempre visível e não seja sobreposto pelo corpo do texto.<br>
Link de Acesso<br>
Observação Positiva: O novo ícone de link está funcional e abre o vídeo corretamente.<br>
Ajuste: Manter o comportamento, mas garantir que o ícone esteja centralizado e alinhado com os outros elementos da linha (Status, Token, etc.).<br>
miniaturas do video<br>
Problema: as thumb não esta aparecendo no local correto na grid.<br>
coluna resumo<br>
Problema: A coluna de resumo está parecendo a transcrição do vídeo.<br>
Melhoria: ajustar para que tenha um texto clicavel Clique aqui para resumir ou colocar um botão para isso.
### A9
Com base na análise do arquivo **agora-codigo_completo (12).txt** e nos documentos de arquitetura das fases 5.7, 5.8 e 5.9, identifiquei que os problemas relatados derivam de um **vazamento de lógica da Aba 2 para a Aba 1** e de configurações incompletas nos renderizadores customizados da grade virtual.

Abaixo, apresento o diagnóstico técnico e as correções necessárias para restaurar a estabilidade do **ContextFlow**:

### 1. Organização e Separação de Dados (Aba 1)
*   **Diagnóstico:** O problema ocorre porque o renderizador `RichTitleRenderer`, projetado para a Aba 2 (Master-Detail), está sendo aplicado globalmente à coluna "Título" na `VirtualVideoTable`. Este renderizador desenha propositalmente o Título e o Canal em duas linhas dentro da mesma célula.
*   **Ajuste:** Na `VirtualVideoTable.GetAttr`, você deve condicionar o uso do `RichTitleRenderer`. Na **Aba 1**, a coluna "Título" deve usar o renderizador de texto padrão e a coluna "Canal" deve buscar o campo `channel_name` do dicionário de dados.

### 2. Largura da Coluna de Link (Aba 1)
*   **Diagnóstico:** A coluna de link (índice 2 na Aba 1) está com um tamanho fixo excessivo (250px) definido no `tab_batch.py`.
*   **Ajuste:** No método `_init_ui` da `TabBatch`, altere `self.grid.SetColSize(2, 250)` para um valor entre **40 e 45px**, que é o tamanho ideal para o ícone gerado pelo `LinkIconRenderer`.

### 3. Consistência Visual (Cores e Vazamento)
*   **Diagnóstico:** O texto cinza em fundo branco indica que as constantes `COLOR_BG` e `COLOR_FG` não estão sendo aplicadas corretamente nos atributos da célula ou o sistema está herdando cores padrão do SO. O vazamento de conteúdo (overlap) ocorre porque o `dc.DrawText` não clipa o texto automaticamente ao tamanho da célula.
*   **Ajuste:** 
    *   **Cores:** Na `VirtualVideoTable.GetAttr`, garanta que `attr.SetBackgroundColour(COLOR_BG)` e `attr.SetTextColour(COLOR_FG)` sejam chamados para todas as células.
    *   **Vazamento:** Nos métodos `Draw` de todos os renderizadores customizados, utilize o `gc.Clip(rect)` (usando `wx.GraphicsContext`) para garantir que nenhum desenho ultrapasse os limites da célula.

### 4. UX no Painel Inferior (Quebra de Linha)
*   **Diagnóstico:** O componente `lbl_side_title` e o `txt_summary` na `TabAnalysis` não estão configurados para gerenciar títulos longos ou quebras automáticas de linha, resultando em cortes visuais.
*   **Ajuste:** Use o método `self.lbl_side_title.Wrap(width)` no evento de seleção e garanta que o `txt_summary` utilize a flag `wx.TE_MULTILINE` com o estilo de wrap ativado no sizer.

### 5. Alinhamento do Ícone de Link
*   **Diagnóstico:** O `LinkIconRenderer` está desenhando o ícone sem considerar o alinhamento central dinâmico baseado no retângulo da célula.
*   **Ajuste:** No método `Draw` do renderizador de link, calcule a posição central subtraindo o tamanho do texto do tamanho do retângulo: `rect.x + (rect.width - tw)//2`.

### 6. Miniaturas na Grid (Thumbnails)
*   **Diagnóstico:** A falha no posicionamento das thumbnails deve-se a uma inconsistência entre o rótulo da coluna no `TabAnalysis` ("Preview") e o mapeamento no `GetAttr` da tabela virtual.
*   **Ajuste:** Sincronize os nomes. Se na Aba 2 a coluna chama-se "Preview", a verificação no `GetAttr` deve ser estritamente `if label == "Preview"` para aplicar o `ThumbnailRenderer`.

### 7. Coluna de Resumo (Texto Clicável)
*   **Diagnóstico:** Atualmente a coluna apenas exibe um snippet da transcrição, o que confunde o usuário.
*   **Ajuste:** No método `GetValue` da tabela virtual, implemente a lógica: se o vídeo não tiver resumo (`summary_text` nulo ou vazio), retorne a string **"✨ Clique aqui para resumir"**. No `GetAttr`, se o valor for este placeholder, aplique `attr.SetTextColour(COLOR_ACCENT)` para sinalizar interatividade.

---

### 📝 COMANDO PARA A IA: CORREÇÃO DE UI E SEGREGAÇÃO DE DADOS

"Atue como **Engenheiro de Software Sênior**. Precisamos sanear os problemas de interface do arquivo **agora-codigo_completo (12).txt** seguindo estritamente o SSoT das Fases 5.8 e 5.9.

**1. Separação de Título/Canal (`ui/virtual_table.py`):**
*   No `GetAttr`, aplique o `RichTitleRenderer` **apenas** se a coluna se chamar 'Preview' ou 'Título' na Aba 2.
*   Na **Aba 1**, restaure a coluna 'Título' como texto simples e a coluna 'Canal' puxando `item.get('channel_name')`.

**2. Ajustes de Renderização e Cores (`ui/virtual_table.py`):**
*   Force `COLOR_BG` (#1E1E1E) e `COLOR_FG` em todas as células via `GetAttr`.
*   Em todos os `Renderers.Draw`, implemente `gc.Clip(rect)` para impedir o vazamento de texto (overlap).
*   No `LinkIconRenderer`, garanta o alinhamento central absoluto do ícone 🔗.

**3. Usabilidade e Dashboards (`ui/tab_batch.py` e `ui/tab_analysis.py`):**
*   Reduza a largura da coluna de Link na Aba 1 para **40px**.
*   Na `TabAnalysis`, implemente quebra de linha automática para o título no painel inferior e ative o `Wrap` para o texto do resumo.
*   Na coluna 'Resumo' da grade, exiba o texto **'✨ Clique aqui para resumir'** em azul (`COLOR_ACCENT`) quando o resumo estiver ausente.

**4. Thumbnails:**
*   Verifique se a coluna de índice 1 na Aba 2 está corretamente mapeada para o `ThumbnailRenderer` sob o rótulo 'Preview'."

---

### Q10
Beleza, as melhorias foram implementadas nessa tela e, por o mocap estar ativado no modo noturno, ele implementou as telas com tudo no modo escuro, a gente precisa configurar isso pra ficar tudo no modo claro normal, o fundo branco, as letras escuras e assim por diante. A gente precisa colocar uma coluna de canal lá na aba Nº2, na aba Nº2 quando eu clico no link não acontece nada, precisamos arrumar isso, as thumbnails não estão aparecendo. O visualizador lá está sempre ativo. Tipo, eu clico em um vídeo e ele está sempre ativo, né? Não tem como, sei lá, desativar ele. Eu acho que seria legal a gente colocar um botão de fechar em algum lugar. E ele também está com o tema escuro ativado, a gente tem que deixar ele no modo tema claro, ativado.
### A10
Com base na análise técnica do arquivo **agora-codigo_completo (13).txt** e nos requisitos de usabilidade do projeto, identifiquei as causas para o comportamento de "Dark Mode" persistente e as falhas funcionais na Aba 2.

Abaixo, apresento o diagnóstico e o roteiro de correções para restaurar o **Tema Claro**, a interatividade dos links e o controle do visualizador Master-Detail:

### 1. Diagnóstico de Temas e Cores (Light Mode)
*   **Causa:** As constantes globais de cores em `constants.py` estão fixadas para o Dark Theme (`30, 30, 30`). Além disso, os atributos de célula na `VirtualVideoTable` forçam essas cores em todas as abas.
*   **Correção:** É necessário inverter os valores das constantes para o padrão de interface claro e remover o "hardcode" de fundo escuro no visualizador de texto.

### 2. Coluna de Canal e Links na Aba 2
*   **Coluna:** A `TabAnalysis` atualmente possui 8 colunas, omitindo o "Canal" que é essencial para triagem.
*   **Link Quebrado:** Diferente da Aba 1, a Aba 2 não possui o evento `EVT_GRID_CELL_LEFT_CLICK` configurado para detectar o clique na coluna de ícone e disparar o navegador.

### 3. Thumbnails e Visualizador "Sempre Ativo"
*   **Thumbnails:** O renderizador busca o rótulo "Preview" no `GetAttr`. Se as imagens não aparecem, pode haver uma falha no carregamento assíncrono do `BitmapCache` ou no redimensionamento para o padrão da grade analítica.
*   **Botão Fechar:** O layout atual usa um `SplitterWindow` que expande automaticamente via lógica **Smart Show**, mas não oferece um gatilho de fechamento manual (Unsplit), mantendo o painel inferior ocupando espaço mesmo após a leitura.

---

### 📝 COMANDO PARA A IA: TRANSIÇÃO PARA TEMA CLARO E AJUSTES ANALÍTICOS

"Atue como **Engenheiro de Software Sênior**. Precisamos converter o sistema para o **Tema Claro (Light Mode)** e corrigir falhas de navegação na **Aba 2 (TabAnalysis)** baseando-se no arquivo **agora-codigo_completo (13).txt**.

**1. Migração para Tema Claro (`constants.py` e `ui/panel_detail.py`):**
*   Em `constants.py`, altere `COLOR_BG` para `wx.WHITE` e `COLOR_FG` para um cinza escuro (ex: `wx.Colour(40, 40, 40)`).
*   No `DetailPanel` (`ui/panel_detail.py`), remova as cores fixas `#1E1E1E` do `txt_content` e do fundo do HTML. O fundo deve ser branco com texto escuro para leitura diurna.
*   Ajuste o fundo das pílulas no `ChipTagRenderer` para cores com opacidade que contrastem no fundo branco.

**2. Expansão da Aba 2 (`ui/tab_analysis.py`):**
*   Adicione a coluna **'Canal'** entre 'Título' e 'Duração' no array `col_labels`.
*   Implemente o método `on_grid_click` (similar ao da `TabBatch`) para detectar o clique na coluna de **Link** e chamar `webbrowser.open(url)`.

**3. Controle do Visualizador (`ui/tab_analysis.py`):**
*   Adicione um **Botão 'Fechar Visualizador' (X)** no topo do `pnl_side_info`.
*   Vincule este botão à função `self.splitter.Unsplit(self.pnl_detail)` para que o usuário possa ocultar o painel inferior manualmente.

**4. Estabilidade de Thumbnails (`ui/virtual_table.py`):**
*   Garanta que o `ThumbnailRenderer` esteja redimensionando corretamente as imagens para 80x45 e que o `BitmapCache` não falhe ao carregar arquivos JPG do `THUMBNAILS_DIR`.

**5. Identidade HeidiSQL na Aba 1:**
*   Certifique-se de que a mudança de cor global não quebre a densidade técnica da Aba 1, mantendo as linhas de grade visíveis."

---

### Q11
veja o arquivo Solicitação: Auditoria de QA e UX/UI e me ajude com as melhorias<br>
o sistema esta retornando isso aqui no terminal Iniciando ContextFlow...<br>
Ambiente: wxpython=4.2.4 msw (phoenix) wxWidgets 3.2.8, tiktoken=OK<br>
Traceback (most recent call last):<br>
File "C:\Users\Usuario\Desktop\contextflow\ui\virtual_table.py", line 76, in Draw<br>
self._draw_bitmap_rich(dc, rect, bmp)<br>
File "C:\Users\Usuario\Desktop\contextflow\ui\virtual_table.py", line 100, in _draw_bitmap_rich<br>
gc.Clip(path)<br>
TypeError: GraphicsContext.Clip(): arguments did not match any overloaded call:<br>
overload 1: argument 1 has unexpected type 'GraphicsPath'<br>
overload 2: argument 1 has unexpected type 'GraphicsPath'<br>
Traceback (most recent call last):<br>
File "C:\Users\Usuario\Desktop\contextflow\ui\virtual_table.py", line 76, in Draw<br>
self._draw_bitmap_rich(dc, rect, bmp)<br>
File "C:\Users\Usuario\Desktop\contextflow\ui\virtual_table.py", line 100, in _draw_bitmap_rich<br>
gc.Clip(path)<br>
TypeError: GraphicsContext.Clip(): arguments did not match any overloaded call:<br>
overload 1: argument 1 has unexpected type 'GraphicsPath'<br>
overload 2: argument 1 has unexpected type 'GraphicsPath'<br>
Traceback (most recent call last):<br>
File "C:\Users\Usuario\Desktop\contextflow\ui\virtual_table.py", line 76, in Draw<br>
self._draw_bitmap_rich(dc, rect, bmp)<br>
File "C:\Users\Usuario\Desktop\contextflow\ui\virtual_table.py", line 100, in _draw_bitmap_rich<br>
gc.Clip(path)<br>
TypeError: GraphicsContext.Clip(): arguments did not match any overloaded call:<br>
overload 1: argument 1 has unexpected type 'GraphicsPath'<br>
overload 2: argument 1 has unexpected type 'GraphicsPath'<br>
Traceback (most recent call last):<br>
File "C:\Users\Usuario\Desktop\contextflow\ui\virtual_table.py", line 76, in Draw<br>
self._draw_bitmap_rich(dc, rect, bmp)<br>
File "C:\Users\Usuario\Desktop\contextflow\ui\virtual_table.py", line 100, in _draw_bitmap_rich<br>
gc.Clip(path)<br>
TypeError: GraphicsContext.Clip(): arguments did not match any overloaded call:<br>
overload 1: argument 1 has unexpected type 'GraphicsPath'<br>
overload 2: argument 1 has unexpected type 'GraphicsPath'<br>
Traceback (most recent call last):<br>
File "C:\Users\Usuario\Desktop\contextflow\ui\virtual_table.py", line 76, in Draw<br>
self._draw_bitmap_rich(dc, rect, bmp)<br>
File "C:\Users\Usuario\Desktop\contextflow\ui\virtual_table.py", line 100, in _draw_bitmap_rich<br>
gc.Clip(path)<br>
TypeError: GraphicsContext.Clip(): arguments did not match any overloaded call:<br>
overload 1: argument 1 has unexpected type 'GraphicsPath'<br>
overload 2: argument 1 has unexpected type 'GraphicsPath'<br>
Traceback (most recent call last): ...<br>
qual seria o plano para corrigir esssas inconsistencias da experiencia de usuario?
### A11
Com base na sua solicitação de auditoria de QA e UX/UI, bem como no erro crítico reportado no terminal, elaborei um plano de ação detalhado para estabilizar o sistema e elevar a qualidade da experiência do usuário no **ContextFlow**.

### 1. Diagnóstico Técnico do Crash (Terminal)

O erro `TypeError: GraphicsContext.Clip(): arguments did not match any overloaded call` ocorre no arquivo `ui/virtual_table.py`.
*   **Causa:** A implementação atual tenta passar um objeto `GraphicsPath` diretamente para o método `gc.Clip()`. Em certas versões do wxWidgets/wxPython (como a 3.2.8/4.2.4 reportada), o método `Clip` aceita apenas coordenadas numéricas ou um `wx.Rect`. Para clipar um caminho complexo (como o retângulo arredondado da thumbnail), deve-se usar um método de interseção ou aplicar o clip retangular simples antes do desenho.
*   **Correção Imediata:** Substituir `gc.Clip(path)` por `gc.Clip(rect.x + 4, rect.y + 4, 80, 45)` para garantir a compatibilidade entre versões, ou utilizar o `dc.SetClippingRegion(rect)` antes de iniciar o `GraphicsContext`.

---

### 2. Plano de Melhorias UX/UI e QA

#### **A. Correções Prioritárias (Usabilidade Direta)**
1.  **Vazamento de Conteúdo (Overflow):**
    *   **Causa:** Ausência de região de clipping nos renderizadores customizados.
    *   **Solução:** Em todos os métodos `Draw` (especialmente `RichTitleRenderer` e `BadgeStatusRenderer`), invocar obrigatoriamente `dc.SetClippingRegion(rect)` no início e `dc.DestroyClippingRegion()` no final para impedir que o texto ou gráficos vazem para as células vizinhas.
2.  **Responsividade do Visualizador (Aba 2):**
    *   **Problema:** Dimensões desproporcionais e falta de auto-ajuste.
    *   **Solução:** Configurar o `wx.SplitterWindow` da Aba 2 com `SetSashGravity(0.5)` para que o redimensionamento da janela principal mantenha as proporções entre a grade e o painel de resumo. Implementar o evento `wx.EVT_SIZE` para invocar o `Wrap()` no título dinamicamente.

#### **B. Ajustes de Interface e Identidade Visual**
1.  **Sincronização de Temas (Aba 3 e Botões):**
    *   **Problema:** Aba 3 inicia em tema escuro e o botão "Exportar" está fixo no Dark Mode.
    *   **Solução:** Substituir cores hardcoded (como `#1E1E1E`) pelas constantes `COLOR_BG` e `COLOR_FG` definidas em `constants.py`. No `DetailPanel`, garantir que o fundo do WebView ou `txt_content` herde `wx.SystemSettings.GetColour(wx.SYS_COLOUR_WINDOW)` na inicialização.
2.  **Arquitetura de Informação (Redundância):**
    *   **Ajuste:** Remover o nome do canal de dentro da coluna "Título" na Aba 1, já que existe uma coluna exclusiva para o Canal. O `RichTitleRenderer` deve ser exclusivo da Aba 2 para fins de triagem densa.

#### **C. Interatividade e Novas Funcionalidades**
1.  **Menu de Contexto (Aba 1 e 2):**
    *   **Implementação:** Vincular o evento `EVT_GRID_CELL_RIGHT_CLICK` à criação de um `wx.Menu` contendo as ações de "Excluir", "Abrir Link" e "Resumir".
2.  **Ordenação de Colunas:**
    *   **Implementação:** Habilitar `EnableDragColMove(True)` e capturar `EVT_GRID_LABEL_LEFT_CLICK` para disparar a ordenação do snapshot do `AppState` antes do `UpdateData` na tabela virtual.
3.  **Checkbox e Preview na Aba 2:**
    *   **Ajuste:** Inserir a coluna `[x]` no índice 0 da Aba 2 e garantir que o `ThumbnailRenderer` esteja corretamente mapeado no `GetAttr` para a coluna de Preview.

---

### 3. Critérios de Aceite e Ordem de Execução

| Ordem | Item | Critério de Aceite |
| :--- | :--- | :--- |
| **1º** | **Correção do Crash** | O sistema inicia sem disparar `TypeError` no terminal ao renderizar miniaturas. |
| **2º** | **Clipping de Células** | Títulos longos são cortados visualmente no limite da coluna, sem sobrepor a coluna vizinha. |
| **3º** | **Aba 2 Funcional** | Presença de Checkbox e Thumbnail funcionando com clique único para seleção. |
| **4º** | **Sincronia de Tema** | Ao iniciar em Light Mode, todas as abas e o visualizador de resumo devem apresentar fundo branco e texto escuro. |
| **5º** | **Menu e Sort** | O clique direito abre opções de ação e o clique no cabeçalho ordena a lista alfabeticamente ou por data. |

Este plano garante que as falhas técnicas sejam resolvidas antes das melhorias estéticas, respeitando a **Lei da Estabilidade (Fase 5.7)** do projeto.

---

### Q12
Na verdade eu coloquei mais coisas No texto está faltando algumas implementações que você ainda não mencionou.<br>
<br>
vc Não colocou por exemplo o menu de contexto que eu mencionei no texto.<br>
<br>
Como todas essas correções que eu mencionei no texto não requer uma fase apenas para isso Podemos fazer tudo isso em um único comando para inteligência artificial execultora do codigo
### A12
Compreendo perfeitamente. Você tem razão: como esses itens são correções de bugs, ajustes de usabilidade e refinamentos de interface que não alteram a arquitetura fundamental do sistema, **podemos consolidar tudo em um único comando de "Saneamento de UX e Auditoria de QA"**.

O menu de contexto e a ordenação são essenciais para que o sistema deixe de ser uma "grade estática" e se torne uma ferramenta produtiva para o Analista Solo.

Abaixo, apresento o comando estruturado para você enviar à IA executora, cobrindo todos os pontos da auditoria, incluindo o menu de contexto, a ordenação e a correção do crash técnico.

---

### 🏛️ COMANDO DE EXECUÇÃO: AUDITORIA DE QA, UX E REFINAMENTO GLOBAL

"Atue como **Engenheiro de Software Sênior e Especialista em UI/UX**. Sua tarefa é sanear o sistema ContextFlow, corrigindo inconsistências visuais, bugs de renderização e implementando recursos de interatividade pendentes nos arquivos `ui/virtual_table.py`, `ui/tab_batch.py`, `ui/tab_analysis.py` e `ui/panel_detail.py`.

#### 1. Correções Técnicas e Estabilidade (Prioridade Zero)
*   **Correção do Crash:** No arquivo `ui/virtual_table.py`, corrija o erro `TypeError: GraphicsContext.Clip()`. Substitua o clipping de `GraphicsPath` por `gc.Clip(rect.x + 4, rect.y + 4, 80, 45)` ou aplique `dc.SetClippingRegion(rect)` antes de iniciar o `GraphicsContext` [Terminal Error].
*   **Fim do Vazamento (Overflow):** Em todos os renderizadores customizados (`RichTitleRenderer`, `BadgeStatusRenderer`, `ThumbnailRenderer`), implemente obrigatoriamente `dc.SetClippingRegion(rect)` no início do método `Draw` e `dc.DestroyClippingRegion()` ao final, para impedir que o conteúdo vaze para células vizinhas.

#### 2. Interatividade de Grade (Abas 1 e 2)
*   **Menu de Contexto (Clique Direito):** Vincule o evento `EVT_GRID_CELL_RIGHT_CLICK` para abrir um `wx.Menu` com as opções: **'🗑️ Excluir'**, **'🔗 Abrir Link'** e **'✨ Resumir'**.
*   **Ordenação (Sort):** Habilite a ordenação da lista ao clicar nos cabeçalhos das colunas (`EVT_GRID_LABEL_LEFT_CLICK`). O clique deve ordenar o snapshot de dados do `AppState` (alfabeticamente ou numericamente) antes de chamar o `UpdateData`.
*   **Cursor de Navegação:** Na coluna de Links, altere o cursor para `wx.CURSOR_HAND` via evento `EVT_MOTION` para indicar que o ícone é clicável.

#### 3. Ajustes de Colunas e Dados
*   **Aba #1 (Doca de Carga):** Remova a redundância do 'Nome do Canal' dentro da coluna 'Título'. A Aba 1 deve exibir o título puro, já que possui uma coluna exclusiva para o Canal.
*   **Aba #2 (Cockpit):** Adicione a coluna de **Checkbox `[x]`** no índice 0 para permitir seleção múltipla e garanta que a coluna de **Preview** exiba as imagens corretamente através do `ThumbnailRenderer`.

#### 4. Consistência de Tema e Visualizador
*   **Sincronia Global de Tema:** Garanta que o sistema inicie 100% em **Light Mode**.
    *   Corrija o botão **'Exportar'** e a **Aba #3** (Leitura Imersiva), que estão iniciando em modo escuro de forma fixa.
    *   Use as constantes `COLOR_BG` (Branco) e `COLOR_FG` (Cinza Escuro) de `constants.py`.
*   **Responsividade do Visualizador:** Configure o `wx.SplitterWindow` na Aba 2 com `SetSashGravity(0.5)` e garanta que o componente de resumo se ajuste proporcionalmente ao redimensionar a janela principal.
*   **Quebra de Texto:** No painel de detalhes e na grade, implemente o truncamento ou quebra de linha para que títulos longos não sejam cortados bruscamente.

#### 5. Feedback Visual
*   **Botão Processar:** Refine o estado de *hover* e as cores do botão 'PROCESSAR FILA' na Aba 1 para que sigam um padrão profissional de 'Productivity Tool'.

**Apresente o código refatorado garantindo o [Isolamento Zero-Knowledge] entre as abas e a manutenção da performance para 10.000 itens.**"

---

### Por que este comando é seguro?
1.  **Resolve o Bloqueio Técnico:** A correção do `GraphicsContext` é a primeira prioridade para que o sistema volte a rodar sem erros no terminal.
2.  **Restaura a Usabilidade:** O menu de contexto e a ordenação devolvem ao sistema o "feeling" de ferramenta profissional que existia na v5.6.
3.  **Mantém o SSoT:** Todas as melhorias utilizam as constantes de cores e o barramento `PubSub` já estabelecidos, evitando a criação de novos padrões conflitantes.
4.  **Habilita a Fase 6:** Ao colocar o checkbox e o botão de resumir no menu de contexto da Aba 2, você deixa o gatilho pronto para quando a IA for integrada na próxima fase.

---

### Q13
eu acho que vamos precisar de uma documentacao para isso. gera para mim e informe quais arquivos documentos vc ira gerar<br>
gere o primeiro arquivo de documentacao para essa fase 5.9 que eu vou colocar na pasta da fase
### A13
Para consolidar a **Fase 5.9 (Restauração do Cockpit Analítico e Saneamento de UX/QA)**, é fundamental documentar tanto a evolução visual da Aba 2 quanto as correções críticas de bugs e usabilidade identificadas na última auditoria. 

Esta fase agora engloba não apenas a estética "Modern/Tailwind" da Aba 2, mas também a estabilização técnica dos renderizadores e a implementação da interatividade (menus e ordenação).

### 📂 Arquivos de Documentação para a Fase 5.9:

1.  **`PHASE_5_9_OVERVIEW.md`**: Visão estratégica, diagnóstico de regressões e rationale do saneamento global.
2.  **`PHASE_5_9_SPECS.md`**: Especificações da topologia Master-Detail, anatomia das colunas e lógica de exibição.
3.  **`PHASE_5_9_RICH_RENDERING.md`**: Detalhamento técnico da correção do crash de Clipping, LRU Cache e renderizadores customizados.
4.  **`PHASE_5_9_UX_QA_AUDIT.md`**: Mapeamento de correções para vazamento de células, menus de contexto, ordenação e sincronia de temas (Light Mode).
5.  **`PHASE_5_9_EXECUTION.md`**: Roteiro passo a passo de implementação nos arquivos `ui/`.
6.  **`Plan_Phase_5_9_Validation.md`**: Critérios de aceite, testes de estresse (10k) e homologação de usabilidade.

---

### 📄 Arquivo 1: `docs/history/PHASE_5.9/PHASE_5_9_OVERVIEW.md`

```markdown
# PHASE 5.9: Restauração do Cockpit Analítico e Saneamento Global (UX/QA)

> **Status:** SSoT (Fonte Única de Verdade)
> **Foco:** Recuperação da Identidade Moderna (Aba 2) e Correção de Inconsistências Críticas
> **Referência:** Mockup v6.0 e Relatório de Auditoria QA

## 1. Contexto e Diagnóstico
Após a segregação física da Fase 5.8, a Aba 2 (Cockpit Analítico) permaneceu em um estado funcional, porém visualmente inconsistente e com regressões de usabilidade. Adicionalmente, a implementação de renderizadores ricos introduziu falhas técnicas (Crashes de Clipping) e vazamentos visuais (Overlap de texto) que prejudicam a experiência do "Analista Solo".

Esta fase decreta o **Saneamento Global do Sistema**, preparando o terreno físico e funcional para a injeção de IA na Fase 6.

## 2. Rationale da Restauração e Saneamento
Diferente da Aba 1, que é otimizada para densidade técnica, a Aba 2 deve ser o centro de conforto analítico.

*   **Identidade Tailwind/Moderno:** Restauração obrigatória de miniaturas inline, pílulas de tags e layout Master-Detail (Splitter).
*   **Correção de Crash de Renderização:** Ajuste imediato do motor de Clipping (`GraphicsContext`) para evitar erros fatais no terminal ao processar thumbnails [Terminal Error log].
*   **Sincronia de Tema (Light Mode):** Padronização rigorosa das cores `COLOR_BG` (Branco) e `COLOR_FG` (Cinza Escuro) em todos os painéis, incluindo a Aba 3 e botões de exportação.
*   **Usabilidade "Clique-e-Vá":** Implementação de menus de contexto (clique direito) e ordenação por cabeçalho em ambas as abas, recuperando a agilidade operacional da v5.6.

## 3. Objetivos Estratégicos da 5.9
*   **Blindagem de Performance:** Garantir que a renderização rica não comprometa a meta de latência de célula < 0.1ms para 10.000 itens.
*   **Isolamento Zero-Knowledge:** Reforçar a barreira entre as abas, garantindo que customizações da Aba 2 (como o Título Rico) não vazem para a Aba 1.
*   **Lógica Smart Show:** Otimizar o Splitter para expandir o visualizador de resumos automaticamente apenas quando houver conteúdo relevante.

## 4. Governança
Toda alteração deve respeitar a **Lei da Estabilidade (Fase 5.7)**. Nenhuma funcionalidade de processamento de IA será implementada nesta fase; o foco é estritamente a infraestrutura de interface e a estabilidade de QA.
```

**Deseja que eu gere o próximo arquivo, `PHASE_5_9_SPECS.md`, detalhando a configuração do Splitter e a nova anatomia das colunas para Aba 2?**

---

### Q14
gere 2. PHASE_5_9_SPECS.md: Especificações da topologia Master-Detail, anatomia das colunas e lógica de exibiçã
### A14
Seguindo o roteiro de documentação para a **Fase 5.9**, apresento o segundo arquivo detalhando as especificações técnicas da **Aba 2 (Cockpit Analítico)**. Este documento integra as definições originais de performance com as correções de usabilidade e interatividade solicitadas na auditoria de QA/UX.

---

### 📄 Arquivo 2: `docs/history/PHASE_5.9/PHASE_5_9_SPECS.md`

```markdown
# PHASE 5.9 SPECS: Especificações do Cockpit Analítico (Aba 2)

> **Status:** SSoT (Fonte Única de Verdade)
> **Alvo:** `ui/tab_analysis.py`
> **Escopo:** Restauração da Interface Moderna, Topologia Master-Detail e Interatividade
> **Referência:** Mockup v6.0 (_mockup.html.txt) e Auditoria QA/UX

## 1. Topologia do Layout (Master-Detail)

A Aba 2 deve implementar obrigatoriamente um layout dinâmico para facilitar a triagem profunda, diferenciando-se da rigidez técnica da Aba 1.

*   **Componente Central:** `wx.SplitterWindow` com orientação horizontal e `SetSashGravity(0.5)` para garantir responsividade ao redimensionar a janela principal.
*   **Painel Master (Topo):** Instância especializada da `VirtualVideoTable` configurada para renderização rica.
*   **Painel Detail (Base):** O `SummaryPanel`, container reativo para exibição do resumo analítico e metadados expandidos.
*   **Estado Inicial:** O Splitter deve iniciar em modo **Unsplit** (painel inferior oculto), preservando a área útil até que ocorra uma ativação por conteúdo.

## 2. Anatomia da Grade Analítica (Colunas)

A grade deve suportar **10.000 vídeos** com latência zero, exibindo metadados focados em inteligência. Conforme auditoria de UX, a redundância do nome do canal dentro do título deve ser removida na triagem densa.

| # | Rótulo | Descrição e Renderer |
| :--- | :--- | :--- |
| 1 | **[x]** | **Checkbox Renderer:** Seleção múltipla para ações em lote (Resumir/Excluir). |
| 2 | **#** | Índice cronológico fixo (ID de ordem). |
| 3 | **Preview** | **Thumbnail Renderer:** Miniatura (80x45) com cantos arredondados e clipping compatível (evitando erros de GraphicsContext) [402, QA Audit]. |
| 4 | **Título** | **RichText Renderer:** Título em negrito. Deve implementar `Wrap` ou truncamento para respeitar o limite da largura. |
| 5 | **Canal** | Coluna exclusiva para o nome do autor/canal, eliminando a redundância na coluna de título [4, Conversation]. |
| 6 | **Duração** | Tempo total formatado (HH:MM:SS). |
| 7 | **Tags** | **Chip Renderer:** Pílulas visuais de contexto (ex: "Liderança", "Finanças"). |
| 8 | **Link** | **LinkIcon Renderer:** Ícone 🔗 centralizado. Deve alterar o cursor para `pointer` (mão) ao passar o mouse. |
| 9 | **Status** | **Badge Renderer:** Círculo colorido (Verde=Completo, Vermelho=Erro, Azul=Processando). |
| 10| **Resumo** | **Interactive Renderer:** Exibe snippet ou o CTA "✨ Clique aqui para resumir" em azul. |

## 3. Lógica de Interatividade e Exibição

### 3.1. Menu de Contexto e Ordenação
*   **Clique Direito:** Implementar `EVT_GRID_CELL_RIGHT_CLICK` para abrir menu com: "🗑️ Excluir", "🔗 Abrir Link" e "✨ Resumir".
*   **Ordenação (Sort):** Habilitar `EVT_GRID_LABEL_LEFT_CLICK` para ordenar o snapshot do `AppState` por qualquer coluna (Título, Canal, Duração, etc.).

### 3.2. Lógica "Smart Show"
1. Ao selecionar uma linha, o sistema consulta o `AppState`.
2. Se `has_summary` for verdadeiro ou houver transcrição, o Splitter executa `SplitHorizontally` automaticamente.
3. O painel inferior deve possuir um **botão de fechar (X)** para retorno manual ao modo Unsplit [Conversation].

### 3.3. Debouncing "Restart-on-Event"
*   O refresh da grade aguarda um silêncio de eventos de **250ms**.
*   Qualquer sinal (`VIDEO_UPDATED`, `TASK_COMPLETED`) reinicia o timer para proteger a UI durante ingestão massiva na Aba 1.

## 4. Requisitos Não Funcionais (RNFs)

*   **Sincronia de Tema:** Sincronização obrigatória com o tema claro do sistema (Light Mode), garantindo fundo branco e texto escuro em todos os painéis e botões.
*   **Isolamento Zero-Knowledge:** A Aba 2 é proibida de importar componentes da Aba 1. Sincronia 100% via `AppState` e `PubSub`.
*   **Performance de Renderização:** O método `GetValue` deve retornar em **< 0.1ms**, utilizando o **LRU Cache** para miniaturas.
```

**Deseja que eu gere o próximo arquivo, `PHASE_5_9_RICH_RENDERING.md`, detalhando a correção técnica do crash de Clipping e o motor de renderização de miniaturas?**

---

### Q15
gere 3.  PHASE_5_9_RICH_RENDERING.md: Detalhamento técnico da correção do crash de Clipping, LRU Cache e renderizadores customizados.
### A15
# PHASE 5.9 RICH RENDERING: Detalhamento do Motor de Renderização

> **Status:** SSoT (Fonte Única de Verdade)
> **Alvo:** `ui/virtual_table.py`
> **Objetivo:** Renderização de alta fidelidade para 10.000+ itens com latência zero e estabilidade técnica.

## 1. Correção Crítica: Crash de Clipping (GraphicsContext)

Identificou-se uma falha fatal (`TypeError`) no motor de renderização rica onde o método `gc.Clip(path)` não reconhecia o argumento `GraphicsPath` em certas versões do wxWidgets [Terminal Error]. Para garantir a **estabilidade operacional**, a estratégia de clipping foi reformulada:

*   **Substituição do Clipping Complexo:** Em vez de confiar em caminhos complexos no `GraphicsContext`, o sistema agora aplica `dc.SetClippingRegion(rect)` no início de cada método `Draw`.
*   **Prevenção de Overflow:** Esta medida é mandatória para **impedir que textos longos vazem para colunas vizinhas**, garantindo que o conteúdo de uma célula seja estritamente confinado ao seu retângulo original.
*   **Finalização Segura:** O uso de `dc.DestroyClippingRegion()` ao final de cada renderização limpa o estado do contexto gráfico, evitando artefatos visuais no scroll.

## 2. Gestão de Mídia: LRU Cache (BitmapCache)

Para suportar bibliotecas de **10.000 vídeos** sem exceder o limite de **250MB de RAM**, implementou-se a classe `BitmapCache`:

*   **Padrão Least Recently Used (LRU):** O cache mantém um dicionário de bitmaps e uma lista de ordem para rastrear o uso.
*   **Limite Estrito:** O sistema armazena no máximo **50 Bitmaps** em memória; ao atingir o limite, o item mais antigo é descartado automaticamente para liberar espaço.
*   **Thread Safety:** Todas as operações de leitura e escrita no cache são protegidas por um `threading.Lock`, garantindo integridade durante o carregamento assíncrono de miniaturas.

## 3. Especificações dos Renderizadores Customizados

### 3.1. ThumbnailRenderer (Preview)
*   **Redimensionamento Mandatário:** Imagens são escalonadas para o padrão **80x45 pixels** com qualidade alta (`IMAGE_QUALITY_HIGH`).
*   **Carregamento Assíncrono:** Para manter o scroll em **60 FPS**, o carregamento do disco ocorre em uma thread separada. Enquanto a imagem não está pronta, um **placeholder escuro** com cantos arredondados é desenhado.
*   **Estética Moderna:** Utiliza `GraphicsContext` para desenhar a miniatura com um **raio de 4px nos cantos** e antialiasing ativo.

### 3.2. RichTitleRenderer (Título/Canal)
*   **Hierarquia Visual:** O título é renderizado em **Negrito (9pt)** na cor `COLOR_FG`, enquanto o nome do canal aparece logo abaixo em **Itálico (8pt)** com cor cinza suave.
*   **Otimização de Espaço:** Este renderizador é exclusivo para a Aba 2 (Cockpit), eliminando a redundância da coluna de canal na visualização densa.

### 3.3. ChipTagRenderer (Context Tags)
*   **Pílulas Visuais (Chips):** As tags são desenhadas como retângulos arredondados com fundo cinza claro e borda sutil.
*   **Lógica de Limpeza:** Para preservar a legibilidade, apenas as **duas primeiras tags** são exibidas na grade; tags excedentes são indicadas por um indicador numérico (ex: "+N").

### 3.4. LinkIconRenderer (Ícone de Acesso)
*   **Identidade Visual:** Exibe o emoji 🔗 em azul (`COLOR_ACCENT`) com **alinhamento central absoluto** dentro da célula.
*   **Affordance de Clique:** Ao pairar o mouse sobre esta coluna, o cursor é alterado para `wx.CURSOR_HAND`, sinalizando interatividade para abertura no navegador.

## 4. Requisitos de Performance de Renderização

1.  **Latência de Célula:** O método `GetValue` deve responder em **menos de 0.1ms** para evitar travamentos durante o scroll massivo.
2.  **Throttling de UI:** O refresh da grade analítica respeita o timer de **250ms (Restart-on-Event)** para não competir com a CPU da Aba 1 durante ingestões massivas.
3.  **Atomicidade:** A renderização rica só ocorre sobre um **snapshot atômico e unificado** do `AppState`, garantindo que não existam estados visuais inconsistentes.

---

### Q16
gere 4.  PHASE_5_9_UX_QA_AUDIT.md: Mapeamento de correções para vazamento de células, menus de contexto, ordenação e sincronia de temas (Light Mode).
### A16
# PHASE 5.9 UX QA AUDIT: Mapeamento de Correções e Saneamento Global

> **Status:** SSoT (Fonte Única de Verdade)
> **Escopo:** Interface e Usabilidade (Abas 1, 2 e 3)
> **Referência:** Auditoria de QA/UX e Código-Fonte v14

## 1. Saneamento de Renderização e Overflow

Identificou-se que o conteúdo de células longas (especialmente títulos e resumos) está **vazando** para colunas adjacentes, prejudicando a leitura e a estética "Pro" do sistema.

*   **Diagnóstico Técnico:** Os renderizadores customizados (`RichTitleRenderer`, `BadgeStatusRenderer`) não implementavam uma região de recorte (clipping), permitindo que o desenho do texto ultrapassasse os limites do retângulo da célula.
*   **Ação Corretiva:** Em todos os métodos `Draw` em `ui/virtual_table.py`, é mandatório o uso de **`dc.SetClippingRegion(rect)`** no início e **`dc.DestroyClippingRegion()`** ao final da renderização.
*   **Critério de Aceite:** Títulos longos devem ser truncados ou cortados visualmente exatamente na borda da coluna, sem sobreposição.

## 2. Interatividade Avançada (Menu de Contexto e Sort)

Para restaurar a agilidade operacional do "Analista Solo", o sistema deve permitir ações rápidas e organização dinâmica da lista.

*   **Menu de Contexto (Clique Direito):** Implementação do evento `EVT_GRID_CELL_RIGHT_CLICK` nas Abas 1 e 2 para exibir um menu contendo as opções: **🗑️ Excluir**, **🔗 Abrir Link** e **✨ Resumir**.
*   **Ordenação (Sort):** Habilitação de interatividade nos cabeçalhos via `EVT_GRID_LABEL_LEFT_CLICK`. O clique deve disparar a ordenação do snapshot de dados no `AppState` antes do refresh da grade.
*   **Cursor Affordance:** Na coluna de links, o cursor deve ser alterado para **`wx.CURSOR_HAND`** via evento `EVT_MOTION`, sinalizando que o ícone é clicável.

## 3. Sincronia de Temas e Identidade Visual (Light Mode)

A auditoria detectou inconsistências onde componentes permaneciam em "Dark Mode" mesmo com o sistema configurado para o tema claro.

*   **Aba 3 (Leitura Imersiva):** Correção da sincronização para que o fundo branco e o texto escuro sejam aplicados corretamente na inicialização.
*   **Botão Exportar:** O botão de exportação, que estava fixo em tema escuro, deve agora herdar as cores das constantes **`COLOR_BG`** e **`COLOR_FG`** de `constants.py`.
*   **Governança de Cores:** Todas as células da grade virtual agora forçam a aplicação do Design System (Fundo Branco/Texto Cinza Escuro) através do método **`GetAttr`**.

## 4. Responsividade e Lógica Master-Detail

O visualizador de resumos na Aba 2 deve se comportar como uma ferramenta de produtividade moderna.

*   **Ajuste de Splitter:** Configuração do `wx.SplitterWindow` com **`SetSashGravity(0.5)`** para garantir que o painel de detalhes e a grade se redimensionem proporcionalmente.
*   **Quebra de Texto (Wrap):** Implementação de quebra automática de linha para o título no painel inferior (`lbl_side_title.Wrap`) para evitar cortes em nomes longos.
*   **Botão de Fechar:** Inclusão de um gatilho manual (X) para que o usuário possa ocultar o visualizador e retornar ao modo **Unsplit** quando desejar.

## 5. Arquitetura de Informação e Dados

*   **Remoção de Redundância (Aba 1):** O nome do canal será removido da coluna "Título" na Aba 1, mantendo apenas o título puro, visto que a aba já possui uma coluna exclusiva para o Canal.
*   **Identificação Híbrida:** A grade deve continuar suportando a seleção e visualização simultânea de vídeos persistidos (ID) e tarefas em processamento (UUID).

---
**Critério de QA Final:** O sistema deve iniciar 100% em **Light Mode**, sem erros de `GraphicsContext` no terminal, e permitir a ordenação total da biblioteca de 10.000 itens com fluidez.

---

### Q17
gere 5.  PHASE_5_9_EXECUTION.md: Roteiro passo a passo de implementação nos arquivos ui/.
### A17
# PHASE 5.9 EXECUTION: Roteiro de Implementação nos Arquivos UI

> **Status:** SSoT (Fonte Única de Verdade)  
> **Objetivo:** Restauração do Cockpit Analítico e Saneamento Global de UX/QA  
> **Alvos:** `ui/virtual_table.py`, `ui/tab_analysis.py`, `ui/tab_batch.py`, `ui/panel_detail.py`  
> **Referências:** Auditoria QA/UX, Mockup v6.0

---

## 1. Passo A: Saneamento do Motor (`ui/virtual_table.py`)

O motor de virtualização deve ser estabilizado tecnicamente para suportar a renderização rica sem vazamentos ou crashes.

1.  **Correção do Crash de Clipping:** Substituir chamadas de `gc.Clip(path)` que utilizam objetos `GraphicsPath` por regiões retangulares compatíveis ou utilizar `dc.SetClippingRegion(rect)` antes de iniciar o `GraphicsContext` [Conversa, 393].
2.  **Prevenção de Overflow:** Em todos os métodos `Draw` (`RichTitleRenderer`, `BadgeStatusRenderer`, `ThumbnailRenderer`), invocar obrigatoriamente `dc.SetClippingRegion(rect)` no início e `dc.DestroyClippingRegion()` no final para impedir o vazamento de conteúdo entre células.
3.  **Implementação do LRU Cache:** Integrar a classe `BitmapCache` com limite estrito de **50 bitmaps** para gerenciar miniaturas em RAM, garantindo scroll de 60 FPS.
4.  **Ajuste de Colunas e Atributos:**
    *   **Aba 1:** Restaurar a coluna "Título" para texto simples, removendo a redundância do nome do canal.
    *   **Aba 2:** Aplicar o `RichTitleRenderer` (Título em negrito + Canal em itálico) e o `ChipTagRenderer` (até 2 tags visíveis).
    *   **Interatividade:** Configurar a coluna de Link para exibir o ícone 🔗 centralizado e retornar `wx.BLUE` no `GetAttr`.

---

## 2. Passo B: Reconstrução do Cockpit (`ui/tab_analysis.py`)

A Aba 2 deve ser transformada em uma interface Master-Detail moderna e reativa.

1.  **Topologia Splitter:** Instanciar um `wx.SplitterWindow` horizontal com `SetSashGravity(0.5)` para garantir redimensionamento responsivo.
2.  **Lógica Smart Show:**
    *   Configurar o painel inferior para iniciar em modo **Unsplit (oculto)**.
    *   No evento de seleção de vídeo, verificar a existência de resumo ou transcrição no `AppState`. Se presente, expandir automaticamente via `SplitHorizontally`.
3.  **Controle Manual:** Adicionar um botão "Fechar Visualizador (X)" no painel de detalhes vinculado a `self.splitter.Unsplit()` [Conversa, 625].
4.  **Toolbar e Busca:** Implementar a barra de ferramentas moderna com placeholders estáticos para "Summarize" e vincular o `SearchCtrl` ao snapshot filtrado do `AppState`.
5.  **Menu de Contexto:** Vincular `EVT_GRID_CELL_RIGHT_CLICK` para exibir menu com as opções "🗑️ Excluir", "🔗 Abrir Link" e "✨ Resumir".

---

## 3. Passo C: Ajustes na Doca de Carga (`ui/tab_batch.py`)

A Aba 1 deve recuperar sua eficiência técnica e densidade de informação.

1.  **Dimensões de Coluna:** Ajustar a largura da coluna de Link (Índice 2) para exatos **40px** para acomodar o ícone centralizado.
2.  **Limpeza de Títulos:** Garantir que a coluna de Título não exiba o nome do canal, preservando a exclusividade da coluna "Canal".
3.  **Interatividade de Grade:**
    *   Implementar a ordenação (Sort) ao clicar no cabeçalho das colunas via `EVT_GRID_LABEL_LEFT_CLICK`.
    *   Garantir que o checkbox da coluna 1 responda ao clique único (One-Click Toggle) sem entrar em modo de edição.
4.  **Apoio ao Tema:** Garantir que todos os botões e fundos respeitem as constantes de **Light Mode** (`COLOR_BG` branco e `COLOR_FG` cinza escuro).

---

## 4. Passo D: Sincronia Global e Tema (`ui/panel_detail.py`)

1.  **Sincronização de Tema:** Corrigir a inicialização da Aba 3 (Leitura Imersiva) para que herde corretamente o fundo branco e texto escuro, eliminando o início em modo escuro fixo.
2.  **Responsividade de Texto:** Implementar o método `Wrap()` nos labels de título e garantir que o componente de texto do resumo utilize quebra de linha automática para evitar cortes horizontais.
3.  **Affordance de Cursor:** Adicionar o evento `EVT_MOTION` para transformar o cursor em "mão" (`wx.CURSOR_HAND`) quando o mouse pairar sobre a coluna de links em ambas as abas.

---

## 5. Definição de Concluído (DoD)

- [ ] Sistema inicia em **Light Mode** sem erros de `TypeError` no terminal [Conversa, 3].
- [ ] Overflow de células eliminado via clipping em todos os renderizadores.
- [ ] Splitter da Aba 2 inicia oculto e expande apenas via lógica **Smart Show**.
- [ ] Menu de contexto e ordenação funcionais nas Abas 1 e 2.
- [ ] Uso de RAM permanece **< 250MB** sob carga de 10.000 itens graças ao LRU Cache.
- [ ] **Isolamento Zero-Knowledge** mantido (nenhuma importação cruzada entre `tab_batch.py` e `tab_analysis.py`).

---

### Q18
gere 6.  Plan_Phase_5_9_Validation.md: Critérios de aceite, testes de estresse (10k) e homologação de usabilidade.
### A18
```markdown
# Plan_Phase_5_9_Validation.md: Plano de Validação do Cockpit Analítico e QA/UX

> **Status:** SSoT (Fonte Única de Verdade)
> **Versão:** 1.0 (Integrada com Auditoria de Saneamento)
> **Objetivo:** Estabelecer critérios de aceite e protocolos de homologação para a restauração visual, performance de escala e interatividade da Aba 2.

---

## 1. Testes de Performance e Estresse (10k)

O Cockpit Analítico deve processar metadados visuais densos sem comprometer a responsividade global.

*   **P01: Latência de Scroll:** Com 10.000 itens carregados no `AppState`, a rolagem da grade virtual deve manter estáveis **60 FPS**.
*   **P02: Renderização de Célula:** O tempo de resposta do método `GetValue` na `VirtualVideoTable` deve ser inferior a **0.1ms**, mesmo com miniaturas e tags ativas.
*   **P03: Consumo de Memória:** O uso total de RAM não deve exceder **250MB** sob carga massiva, validando o **LRU Cache** de 50 Bitmaps.
*   **P04: Time To Interactive (TTI):** A grade deve responder a comandos de scroll ou clique em menos de **50ms**.

## 2. Validação de Layout e Reatividade (Splitter)

A topologia **Master-Detail** deve operar de forma adaptativa e isolada.

*   **L01: Estado Inicial:** O `wx.SplitterWindow` deve iniciar em modo **Unsplit** (painel inferior oculto).
*   **L02: Lógica "Smart Show":** Ao selecionar um vídeo com resumo ou transcrição, o painel deve expandir-se automaticamente (`SplitHorizontally`).
*   **L03: Controle Manual:** O botão **"Fechar Visualizador (X)"** deve ocultar o painel inferior instantaneamente.
*   **L04: Debouncing de Refresh:** A interface da Aba 2 deve aguardar um silêncio de eventos de **250ms (Restart-on-Event)** antes de atualizar a lista.

## 3. Integridade Estética e UX (Light Mode)

A Aba 2 deve refletir a identidade visual moderna e as correções da auditoria.

*   **E01: Sincronia de Tema:** Todo o sistema deve iniciar em **Light Mode** (Fundo Branco/Texto Cinza Escuro), incluindo a Aba 3 e o botão "Exportar".
*   **E02: Renderização Rica:** As thumbnails (80x45) devem possuir cantos arredondados e as tags devem ser exibidas como pílulas (chips).
*   **E03: Fim do Overflow:** O conteúdo de células longas deve ser estritamente confinado ao seu retângulo (Clipping), sem vazar para colunas vizinhas.
*   **E04: Hierarquia de Texto:** Na Aba 2, o título deve aparecer em **negrito** com o canal em *itálico* logo abaixo; na Aba 1, o título deve ser texto puro.
*   **E05: Affordance de Link:** A coluna de links deve exibir o ícone 🔗 em azul e alterar o cursor para **"mão"** (`wx.CURSOR_HAND`) ao passar o mouse.

## 4. Interatividade e Funcionalidades Pendentes

*   **F01: Menu de Contexto (Clique Direito):** Deve abrir opções para **Excluir**, **Abrir Link** e **Resumir** em ambas as abas.
*   **F02: Ordenação (Sort):** Clicar nos cabeçalhos das colunas deve ordenar o snapshot de dados alfabética ou numericamente.
*   **F03: Checkbox One-Click:** A seleção via checkbox na coluna 1 deve alternar o estado com apenas um clique, sem entrar em modo de edição.

## 5. Auditoria de Segregação (Zero-Knowledge)

*   **A01: Isolamento de Contexto:** Nenhuma importação de `ui/tab_batch.py` deve existir em `ui/tab_analysis.py`.
*   **A02: Sincronia via AppState:** Todas as mutações visuais devem derivar exclusivamente de notificações do **AppState** ou **PubSub**.
*   **A03: Thread-Safety:** Atualizações de UI vindas do `Processor` (threads secundárias) devem ser envelopadas em **`wx.CallAfter`**.

---
**Critério de Homologação:** A Fase 5.9 será considerada concluída quando 100% dos testes acima apresentarem status **PASS** sob uma carga de 5.000 a 10.000 vídeos reais.
```
