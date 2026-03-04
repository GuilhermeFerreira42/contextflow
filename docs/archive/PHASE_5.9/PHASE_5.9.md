
Para dar início à **Fase 5.9 (Restauração do Cockpit Analítico)**, focaremos em devolver à Aba 2 a riqueza visual e funcional da versão 5.5, operando agora sob a arquitetura de **Segregação Tática** e performance de larga escala (10.000+ vídeos) estabelecida nas fases 5.7 e 5.8.

Diferente da Aba 1, que possui uma "alma técnica" (estilo HeidiSQL), a **Aba 2** será consolidada como o centro de experiência **Moderno/Tailwind**, focada na triagem inteligente e visualização Master-Detail.

### 📂 Arquivos a serem gerados para a Fase 5.9:

1.  **`PHASE_5_9_OVERVIEW.md`**: Visão estratégica e justificativa para a restauração da estética moderna.
2.  **`PHASE_5_9_SPECS.md`**: Especificações técnicas das colunas analíticas, layout do Splitter e lógica de exibição.
3.  **`PHASE_5_9_RICH_RENDERING.md`**: Detalhamento do motor de renderização rica (thumbnails via LRU Cache e chips de tags).
4.  **`PHASE_5_9_EXECUTION.md`**: Roteiro de implementação passo a passo para o arquivo `ui/tab_analysis.py`.
5.  **`Plan_Phase_5_9_Validation.md`**: Critérios de aceite, incluindo testes de performance de scroll e reatividade do Splitter.

---

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

-------------

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

-------


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
---------

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

-----------


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