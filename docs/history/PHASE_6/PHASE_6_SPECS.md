# PHASE 6 SPECS (ESPECIFICAÇÕES REFORMULADAS)

**1. Layout Aba 2 (Master-Detail Pragmático):**
- Implementação de `wx.SplitterWindow` na Aba 2.
- **Master (Topo):** `VirtualVideoTable`.
- **Detail (Base):** Painel de resumo persistente. 
- **Decisão Crítica:** Removido o "Smart Show" (expansão automática). O painel mantém posição definida pelo usuário ou estado binário (aberto/fechado) para evitar instabilidade visual ("pula-pula").

**2. AIService (O Core):**
- Abstração de provedores via Strategy.
- Verificação obrigatória de cache no SQLite antes de qualquer chamada externa.
- Estimativa de custo de tokens antes da execução (Governança).

**3. UX Analítica:**
- **Double-Click:** Expande célula de texto com scroll interno.
- **Sorting:** Cabeçalhos clicáveis com ordenação delegada ao `AppState`.

**4. Configurações:**
- Persistência inicial via `config.json`.
- UI de configurações (`SettingsDialog`) postergada para o final da fase para evitar desperdício de capital em funcionalidade de suporte.
