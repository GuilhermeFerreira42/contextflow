# ROADMAP: ContextFlow

> **Visão:** Do Caos ao Contexto Acionável - Estabilidade e Performance para o Analista Solo.
> **Status Atual:** FASE 5.7 (Consolidação Estrutural).
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

## 🚧 FASE 5.7: Consolidação Estrutural (EM ANDAMENTO)
> **Foco:** Segregação Tática de UI e Estabilização do Core.
> **Meta:** Zero vazamento de layout e isolamento físico das abas.

### 5.7.1. Segregação Física de UI
* **Aba 1 (Doca de Carga):** Criação do `ui/tab_batch.py` focado em ingestão massiva, sem splitters ou grid.
* **Aba 2 (Cockpit Analítico):** Criação do `ui/tab_analysis.py` com layout Master-Detail e Grid Virtualizada.
* **Protocolo Zero-Knowledge:** Garantir que nenhuma aba possua referência ou importação direta de outra.

### 5.7.2. Performance e Reatividade Hardened
* **Debouncing (Restart-on-Event):** Implementação de `wx.Timer` de 250ms que reinicia a cada evento de update, protegendo a UI durante cargas massivas.
* **Virtualização de Status:** Feedback de carga na Aba 1 preparado para 10.000 URLs.
* **Demolição do Legado:** Extinção física do arquivo `ui/panel_grid.py` e limpeza de heranças obsoletas.

---

## 🔒 FASES FUTURAS (Interditadas)
> **Nota:** O desenvolvimento das fases abaixo está bloqueado até a homologação total da estabilidade física da Fase 5.7.

* **FASE 6:** Insights, Valor e IA (Resumos, Tags automáticas, UI de leitura melhorada).
* **FASE 7:** Manutenção Zero e Escala (RAG Local, Atualização automática de binários).
* **FASE 8:** Personalização e Filtros Avançados (Filtros cruzados, Tags dinâmicas).

**Para detalhes sobre o planejamento destas fases, consulte:** `docs/BACKLOG_FUTURO.md`.