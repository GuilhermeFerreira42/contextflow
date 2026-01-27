# FASE 5.6: ESTRATÉGIA E RISCO

## 1. Diagnóstico de Risco

A transição direta para a Fase 6 (IA e Insights) apresenta dois riscos existenciais para o projeto:

### 1.1. O Risco da Extração (The Gatekeeper)
O YouTube é um adversário ativo. O aumento do volume de dados (necessário para alimentar a IA) aumentará exponencialmente a probabilidade de bloqueios (HTTP 429).
*   **Impacto:** Se a extração para, o software vira uma "casca vazia".
*   **Mitigação:** Tratar a camada de `YouTubeManager` não como um script, mas como um subsistema de **guerra eletrônica** (rotação, persistência, disfarce).

### 1.2. O Risco do Custo (The Money Burner)
APIs de LLM (GPT-4, etc.) cobram por token. Processar vídeos longos ou playlists inteiras sem governança pode gerar custos inaceitáveis rapidamente.
*   **Impacto:** O usuário abandona a ferramenta por medo da fatura.
*   **Mitigação:** Implementar "Orçamento Rígido", Estimativa Prévia e Cache Agressivo (Hash-based).

## 2. Rationale: A Lógica da Blindagem

A "Blindagem" é o pré-requisito para a escala. Não podemos construir um arranha-céu (Fase 6) sobre uma fundação que treme (extração instável) e custa caro demais para manter (falta de governança).

**A Fase 5.6 inverte a prioridade:**
*   De: "Baixar o máximo possível".
*   Para: "Baixar com segurança e custo zero de retrabalho".

## 3. Escopo Negativo (O que NÃO faremos)

Para garantir o foco, os seguintes itens são **explicitamente proibidos** nesta fase:

*   **UX/UI:** Nenhuma nova janela, animação ou redesign. Apenas modais de confirmação de sistema.
*   **Engenharia de Prompt Avançada:** O foco é *poder chamar* a IA, não a qualidade literária do resumo.
*   **Métricas de Vaidade:** Não mediremos "número de downloads", mas sim "taxa de sucesso sustentada".

## 4. Definition of Done (Critérios Técnicos de Aceite)

A Fase 5.6 só será considerada concluída quando **TODOS** os itens abaixo forem verdadeiros e verificáveis:

1.  **Extração Sustentável:** O sistema opera por `[PARAM_MIN_HOURS]` horas contínuas com taxa de erro 429 inferior a `[PARAM_MAX_ERROR_RATE]%`.
2.  **Governança de Custo:**
    *   Impossível chamar a IA sem ver a estimativa de custo antes.
    *   Impossível reprocessar um texto idêntico (Hash Match) e pagar de novo (Cache Hit obrigatório).
3.  **Métricas Reais:** O painel de debug exibe TTI (Time To Insight) real.
4.  **Rollback Automático:** O sistema interrompe operações se os erros ou custos excederem os `[PARAM_SAFETY_LIMITS]`.

## 5. Limites Operacionais (Performance & Arquitetura)

*   **Proibição de Snapshot Global:** É vetado realizar cópias profundas da lista completa (`get_all_videos()`) para renderização.
*   **Contrato de Lazy Loading (Obrigatório):**
    *   O `AppState` DEVE implementar método paginado: `get_video_page(offset, limit)`.
    *   A `VirtualTable` da Grid solicita apenas os dados visíveis (+ buffer).
    *   Isso elimina o travamento de GIL O(n) e permite listas infinitas.
*   **Otimização de GIL:** Operações de escrita massiva no DB devem ocorrer em thread dedicada.


> **Nota:** Todos os valores marcados como `[PARAM_...]` devem ser configuráveis em `constants.py` ou configurações do usuário, nunca hardcoded.
