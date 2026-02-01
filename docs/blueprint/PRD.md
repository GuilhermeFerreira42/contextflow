# PRD: ContextFlow - Estação de Triagem para Analista Solo

> **Versão:** 1.0 (Consolidação Estrutural)
> **Data:** 01 de fevereiro de 2026
> **Status:** LEI DA ESTABILIDADE ATIVA (Fase 5.7)
> **Proprietário:** Engenharia ContextFlow

## 1. Visão Geral do Produto

### Identidade do Produto
- **Slogan:** "Posse total de dados e triagem massiva para o Analista Solo."
- **Missão:** Isolar, extrair e organizar conteúdo do YouTube em escala, garantindo performance fluida com bibliotecas massivas sem dependência de nuvem.

### Persona Principal (O Analista Solo)
| Persona | Dor Principal | Trabalho a ser Feito |
| :--- | :--- | :--- |
| **O Analista** | Sobrecarga de dados e lentidão em ferramentas tradicionais. | "Extrair dados brutos de centenas de vídeos e realizar triagem rápida em uma interface Master-Detail de alta performance." |

**Decisão Estratégica:** O ContextFlow abandona o modelo de "baixador genérico" para focar 100% na **Segregação Tática**. A prioridade absoluta é a estabilidade da interface e a virtualização de dados.

## 2. Topologia Arquitetural (Trindade de Isolamento)

O sistema opera sob o protocolo **Zero-Knowledge**, onde as três entidades de interface são fisicamente independentes e não possuem referências diretas entre si.

1.  **Aba 1 (Doca de Carga):** `ui/tab_batch.py`. Exclusiva para entrada de URLs e feedback de fila. É proibido o uso de Splitters ou Grid aqui.
2.  **Aba 2 (Cockpit Analítico):** `ui/tab_analysis.py`. Centro de triagem Master-Detail. Único local permitido para a `VirtualVideoTable` e o `wx.SplitterWindow`.
3.  **Aba 3 (Leitura Imersiva):** `ui/panel_detail.py`. Visualização de texto em tela cheia para análise profunda.

## 3. Estrutura de Diretórios Saneada (SSoT)

```text
contextflow/
├── core/
│   ├── app_state.py      # Singleton: Única Fonte de Verdade (AppState)
│   ├── processor.py      # Orquestração de tarefas assíncronas
│   └── pubsub.py         # Barramento de eventos para desacoplamento
├── storage/
│   └── db_handler.py     # Persistência SQLite3
├── ui/
│   ├── app_window.py     # Maestro da Topologia (Notebook 3 Abas)
│   ├── tab_batch.py      # Ingestão estática e leve
│   ├── tab_analysis.py   # Cockpit Master-Detail (Splitter)
│   ├── panel_detail.py   # Visualização de transcrição bruta
│   └── virtual_table.py  # Motor de virtualização da Grid
└── main.py               # Ponto de entrada
```

## 4. Requisitos Não Funcionais (RNFs) - Metas de Estresse

| Métrica | Alvo Mandatório | Contexto |
| :--- | :--- | :--- |
| **Escalabilidade** | 10.000 vídeos | Suporte a bibliotecas grandes sem degradação. |
| **Latência de Célula** | < 0.1ms | Renderização na `VirtualVideoTable`. |
| **Uso de RAM (Idle)** | < 200MB | Eficiência em repouso. |
| **Uso de RAM (Carga)** | < 250MB | Processamento de 10.000 itens. |
| **TTI (Interactive)** | < 50ms | Tempo para grid responder ao scroll. |

## 5. Regras Pétreas de Desenvolvimento (Auditoria)

1.  **Interdição de Legado:** O arquivo `ui/panel_grid.py` é considerado inexistente. O sistema recusa qualquer importação vinda dele.
2.  **Isolamento Zero-Knowledge:** É terminantemente proibido importar classes de uma aba dentro de outra. A sincronia é 100% via `AppState` e `PubSub`.
3.  **Debouncing Mandatário:** O refresh da Grid na Aba 2 deve aguardar um silêncio de 250ms (Timer Restart-on-Event) para evitar jitter visual.
4.  **Proibição de IA (Fase 6):** Qualquer referência a "Insights", "Resumos" ou "IA" neste documento é nula até a estabilização física da Fase 5.7.