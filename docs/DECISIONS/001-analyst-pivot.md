# ADR 001: Pivô para Perfil Analista

* **Data:** 25/01/2026
* **Contexto:** O software tentava atender arquivistas (download massivo) e analistas ao mesmo tempo, gerando complexidade e dívida técnica.
* **Decisão:** Focar 100% no Analista. Priorizar UX de Leitura e IA sobre robustez de download.
* **Consequências:** Refatoração imediata da Grid para performance (Virtualização) e implementação de Master-Detail.
