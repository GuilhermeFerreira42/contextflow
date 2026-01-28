# ROADMAP: ContextFlow

> **Visão:** Do Caos ao Contexto Acionável.
> **Status:** Fase 6 em preparação.

## ✅ FASE 1-4: Fundação (Concluído)
*   Sistema básico de download (yt-dlp).
*   Banco de dados SQLite.
*   Interface wxPython básica.
*   Contagem de Tokens.

## ✅ FASE 5: Refatoração de Arquitetura (Concluído)
*   Extração de `AppState`.
*   Implementação de Threading Básico.

## ✅ FASE 5.5: Operação "Monolito Zero" (Concluído - Jan 2026)
*   [x] **Virtualização da Grid:** Suporte a 5.000+ vídeos sem lag.
*   [x] **Desacoplamento UI/Core:** PubSub implementado.
*   [x] **Serviços Isolados:** Exportação independente.
*   [x] **Limpeza:** `panel_grid.py` higienizado.

---

## 🚧 FASE 5.6: Blindagem Operacional (EM ANDAMENTO)
> **Foco:** Resiliência contra YouTube e Controle de Custo de IA.
> **Status:** Execução Documental concluída. Implementação iniciada.

### 5.6.1. Blindagem (Anti-Ban)
*   Cookies, Headers Rotativos, Backoff Inteligente.
*   Objetivo: Zero perda de dados por bloqueio 429.

### 5.6.2. Governança (Anti-Falência)
*   Nenhuma IA roda sem estimativa prévia.
*   Nenhum prompt repetido paga duas vezes (Hash Cache).

---

## 🔒 FASE 6: Insights e Valor (BLOQUEADA)
> **Status:** BLOQUEADA até conclusão da Fase 5.6.
> **Foco:** Transformar dados brutos em informação útil. Estabilidade do Core permite focar em Features agora.

### 6.1. Integração de IA (Opcional)
*   **Pré-requisito:** Core estável (Fase 5.5).
*   **Conceito:** Plugin de "Resumo".
*   **Técnica:** Chamada a API (OpenAI/Ollama) via `AIService`.
*   **Restrição:** Falha na IA não trava o app.

### 6.2. UI de Leitura Melhorada
*   Painel de leitura com formatação Markdown real (não apenas HTML injetado).
*   Busca interna no texto da transcrição.

### 6.3. Organização
*   Tags manuais.
*   Filtros na Grid (ex: "Mostrar apenas não lidos").

---

## 🔮 FASE 7: Manutenção Zero & Escala
*   Logs de diagnóstico automatizados.
*   Update automático de binários (yt-dlp).
*   Suporte a Vetores (RAG Local).

## 💩 Dívidas Técnicas Aceitas
*   **UI:** `wxPython` é verboso, mas estável. Não migrar framework.
*   **Banco:** SQLite é suficiente. Não migrar para Postgres.
*   **Testes:** Cobertura focada em regressão crítica (Exportação), não 100% unitário.
