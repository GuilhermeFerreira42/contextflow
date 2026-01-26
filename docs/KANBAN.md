# KANBAN: Prioridade Pragmática (AMV)

> **Meta:** Garantir que a ferramenta funcione para sempre com manutenção zero.

## ✅ FASE 5.5: Estabilização de Core (CONCLUÍDO)
*Concluída em Jan 2026. Core estabilizado.*

- [x] **[ARCH] Isolamento de Exportação**
    - [x] Criar `services/export_service.py`.
    - [x] Garantir que ZIP/TXT funcionem independente da Grid ou IA.
    - [x] Testar exportação (Regressão validada).
- [x] **[UI] Motor Virtual (wx.grid.PyGridTableBase)**
    - [x] Implementar `VirtualTable` conectada ao `AppState`.
    - [x] Remover lógica de armazenamento do `panel_grid.py`.
    - [x] Validar scroll liso com 5.000 itens (0ms render).
- [ ] **[DATA] Higiene e Compressão** (Movido para Fase 6/Manutenção)
    - [ ] Adicionar compressão `zlib`.
    - [ ] Script de VACUUM.

## 🔨 FASE 6: Insights e Resumos (PRÓXIMO)
- [ ] **[IA] Integração Opcional**
    - [ ] Implementar chamadas de IA como "Plugin" que pode falhar sem quebrar o app.
    - [ ] Botão "Gerar Resumo" manual (sob demanda).
- [ ] **[UI] Painel de Leitura**
    - [ ] Exibir resumo e transcrição lado a lado.
    - [ ] Busca textual na transcrição.

## 📦 FASE 7: Manutenção Zero
- [ ] **[OPS] Logs e Diagnóstico**
    - [ ] Logs automáticos de erros de download (yt-dlp).
    - [ ] Botão "Atualizar yt-dlp" na interface.