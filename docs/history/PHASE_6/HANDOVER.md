Este documento de **Handover** serve como a instrução mestre e o nexo de continuidade para a inteligência artificial encarregada da **Fase 6 (Insights e Valor)**. Ele consolida a fundação física blindada na Fase 5.12 e projeta a camada de inteligência analítica para o **Analista Solo**.

---

# HANDOVER: TRANSIÇÃO PARA ESTAÇÃO ANALÍTICA (FASE 6)

### 1. Status Atual e Fundação Saneada (v32)
O sistema foi estabilizado utilizando a **Versão 32** do código como única **Fonte de Verdade (SSoT)**. A infraestrutura de extração está blindada contra vazamentos de layout e ambiguidades operacionais.
*   **Topologia de 3 Abas:** As abas 1 (Batch), 2 (Analysis) e 3 (Detail) estão fisicamente separadas sob o **Protocolo Zero-Knowledge**, proibindo qualquer importação mútua direta.
*   **Motor de Virtualização:** A `VirtualVideoTable` suporta 10.000 itens com latência de célula < 0.1ms.
*   **Resiliência de Rede:** Implementado o **Kill-Switch** de threads bloqueantes via `InterruptibleLogger` e suporte a cookies Netscape e rotação de proxies.

### 2. Diretrizes Arquiteturais Inegociáveis (A Lei da Estabilidade)
Qualquer implementação na Fase 6 deve respeitar as seguintes "travas de segurança" para evitar regressões:
*   **Isolamento de Componentes:** O arquivo `ui/panel_grid.py` está **extinto e interditado**. A lógica de análise reside exclusivamente na Aba 2 (`ui/tab_analysis.py`).
*   **Trava de Hardware (Ollama):** Provedores locais (Ollama) devem ser forçados a **exatamente 1 tarefa simultânea** via semáforo no backend para proteger a CPU/GPU do usuário.
*   **Calculadora Universal de Tokens:** A contagem de tokens deve ser agnóstica a provedores, abandonando a dependência exclusiva do `tiktoken` (OpenAI) para suportar Anthropic, Gemini e GROQ.

### 3. Especificações Técnicas da Fase 6 (Insights e Valor)
O objetivo é transformar transcrições em inteligência competitiva.
*   **Live Context (AppState):** O resumo em streaming deve residir no `AppState._live_analysis_buffer`. Ambas as abas de análise (2 e 3) assinam o mesmo tópico PubSub para que, se o usuário alternar de aba durante a geração, o conteúdo parcial seja preservado sem nova requisição.
*   **Protocolo Anti-Flicker:** A renderização física do resumo só deve ocorrer a cada **500ms** ou ao atingir um buffer de **100 caracteres**, evitando sobrecarga da Main Thread.
*   **Renderizador de Fallback:** O sistema deve tentar instanciar `wx.html2.WebView` (Markdown). Se o ambiente Windows falhar (falta de WebView2), deve realizar downgrade silencioso para `wx.TextCtrl` sem crashar o app.
*   **Evolução Atômica do Schema:** O `DatabaseManager` deve realizar a migração automática via `ALTER TABLE` para criar a tabela `summaries` e as colunas de governança de custo (`input_tokens`, `prompt_hash`).

### 4. Protocolo de UX e Interatividade
*   **Cockpit Analítico (Aba 2):** Deve operar no layout **Master-Detail**. A grade superior (Master) e o painel de resumo inferior (Detail) são mediados pela lógica **"Smart Show"**, que expande o painel automaticamente apenas ao encontrar vídeos com conteúdo processado.
*   **Estratégia de Purga:** Ao cancelar uma tarefa, o sistema remove itens não concluídos do buffer visual, mantendo a grade limpa e focada em dados íntegros.
*   **Status Chip na Toolbar:** Exibição em tempo real do provedor e modelo ativos (ex: [ ?? OpenAI | gpt-4o ]).

### 5. Riscos a serem Vigiados
1.  **Sequestro de Interface:** O streaming de IA não deve bloquear o scroll da grade virtual.
2.  **Dreno de Capital:** Chamadas em lote (Batch Summarizer) devem exigir um **Pre-flight Check** exibindo o custo estimado antes da execução.
3.  **Envenenamento de Contexto:** A IA executora não deve ler arquivos da Fase 5.5 ou 5.6 (históricos) para evitar a reativação de bugs antigos.

---

**Veredito de Prontidão:** O sistema está fisicamente segregado e administrativamente blindado. A Fase 6 deve ser construída sobre esta fundação, focando no **desacoplamento via Factory** e na **resiliência da interface**.