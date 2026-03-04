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
