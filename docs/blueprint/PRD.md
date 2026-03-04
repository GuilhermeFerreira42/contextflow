# PRD: ContextFlow - Estação de Triagem para Analista Solo

> **Versão:** 1.1 (Maturidade Industrial)
> **Data:** 04 de março de 2026
> **Status:** ESTABILIZADO (Fase 5.12 Concluída)
> **Proprietário:** Engenharia ContextFlow

## 1. Visão Geral do Produto

### Identidade do Produto
- **Slogan:** "Posse total de dados e triagem massiva para o Analista Solo."
- **Missão:** Isolar, extrair e organizar conteúdo do YouTube em escala, garantindo performance fluida com bibliotecas massivas sem dependência de nuvem.

### Persona Principal (O Analista Solo)
| Persona | Dor Principal | Trabalho a ser Feito |
| :--- | :--- | :--- |
| **O Analista** | Sobrecarga de dados e lentidão em ferramentas tradicionais. | "Extrair dados brutos de centenas de vídeos e realizar triagem rápida em uma interface Master-Detail de alta performance." |

## 2. Topologia Arquitetural (Trindade de Isolamento)

O sistema opera sob o protocolo **Zero-Knowledge**, onde as três entidades de interface são fisicamente independentes e não possuem referências diretas entre si.

1.  **Aba 1 (Doca de Carga):** `ui/tab_batch.py`. Exclusiva para entrada de URLs e feedback de fila.
2.  **Aba 2 (Cockpit Analítico):** `ui/tab_analysis.py`. Centro de triagem Master-Detail. Único local permitido para a `VirtualVideoTable`.
3.  **Aba 3 (Leitura Imersiva):** `ui/panel_detail.py`. Visualização de texto em tela cheia para análise profunda.

## 3. Infraestrutura Estabilizada (Cimentos de Base)

### 3.1. "O Cofre" (Governança de Custos)
Mecanismo centralizado em `core/ai_governance.py` e `core/token_engine.py` para contagem rigorosa de tokens e auditoria de custos de API.

### 3.2. "O Escudo" (Proteção de Ingestão)
Sistema de rotação de proxies e gerenciamento de cookies em `core/proxy_manager.py` e `core/cooldown_manager.py` para evitar bloqueios IP (Erro 429).

## 4. Requisitos Não Funcionais (RNFs) - Metas Industriais

| Métrica | Alvo Mandatório | Contexto |
| :--- | :--- | :--- |
| **Escalabilidade** | 10.000 vídeos | Suporte a bibliotecas grandes sem degradação. |
| **Latência de Célula** | < 0.1ms | Renderização na `VirtualVideoTable` com Clipping. |
| **Uso de RAM (Carga)** | < 250MB | Processamento e exibição de 10.000 itens. |
| **TTI (Interactive)** | < 50ms | Tempo para grid responder ao scroll 60 FPS. |

## 5. Regras Pétreas de Desenvolvimento (Auditoria)

1.  **Interdição de Legado:** O arquivo `ui/panel_grid.py` é considerado inexistente.
2.  **Isolamento Zero-Knowledge:** Proibida a importação de classes entre abas. Sincronia via `AppState` e `PubSub`.
3.  **Debouncing Mandatário:** Refresh da Grid na Aba 2 deve aguardar silêncio de 250ms.
4.  **Bisturi, não Marreta:** Qualquer nova alteração deve ser cirúrgica, preservando a estabilidade da Phase 5.12.
