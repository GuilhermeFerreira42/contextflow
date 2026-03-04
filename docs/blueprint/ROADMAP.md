# ROADMAP: ContextFlow

> **Visão:** Do Caos ao Contexto Acionável - Estabilidade e Performance para o Analista Solo.
> **Status Atual:** FASE 6.1 (Preparação para IA e Valor).
> **Princípio:** "Construir a fundação antes de erguer o teto."

## ✅ FASE 1-4: Fundação (Concluído)
* **Motor de Extração:** Integração base com `yt-dlp`.
* **Persistência:** Schema inicial do banco de dados SQLite.
* **Interface:** Protótipo funcional em wxPython.
* **Core:** Contagem de tokens e extração de transcrições básicas.

## ✅ FASE 5: Refatoração e Estado (Concluído)
* **AppState:** Extração da lógica de estado para um Singleton centralizado.
* **Threading:** Implementação de processamento assíncrono para evitar travamento de UI.
* **Governança:** Sistema de auditoria de custos e tokens (O Cofre).
* **Resiliência:** Rotação de proxies e suporte a cookies (O Escudo).

## ✅ FASE 5.5: Operação "Monolito Zero" (Concluído)
* **Virtualização:** Implementação da `VirtualVideoTable` para suporte a 10.000 vídeos.
* **Desacoplamento:** Comunicação via PubSub para eliminar dependências circulares.
* **Isolamento:** Separação dos serviços de exportação do núcleo da UI.
* **Limpeza:** Higienização da classe `GridPanel` (Redução de 70% da complexidade).

---

## ✅ FASE 6.0: Blindagem Estrutural (Concluído)
* **Arquitetura Facade**: AppState refatorado como fachada de delegação pura.
* **Gerentes Especializados**: Criação de `VideoManager`, `FinanceManager`, `TaskManager` e `ThemeManager`.
* **Cofre (billing.db)**: Implementação de banco isolado e transacional para auditoria financeira.
* **Semáforo de IA Local**: Controle de concorrência rígido (Max: 1) para o provedor Ollama.
* **Saneamento de UI**: 100% de adesão ao `ThemeManager` e extinção física de `ui/panel_grid.py`.

---

## 🚧 FASES FUTURAS (Interditadas)
> **Nota:** O desenvolvimento das fases abaixo está bloqueado até a homologação total da estabilidade física da Fase 5.7.

* **FASE 6:** Insights, Valor e IA (Resumos, Tags automáticas, UI de leitura melhorada).
* **FASE 7:** Manutenção Zero e Escala (RAG Local, Atualização automática de binários).
* **FASE 8:** Personalização e Filtros Avançados (Filtros cruzados, Tags dinâmicas).

**Para detalhes sobre o planejamento destas fases, consulte:** `docs/BACKLOG_FUTURO.md`.