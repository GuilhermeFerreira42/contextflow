# KANBAN: Prioridade Pragmática (AMV)

> **Meta:** Garantir que a ferramenta funcione para sempre com manutenção zero.

## 🚨 FASE 5.5: Estabilização de Core (CRÍTICO)
*Nenhuma feature nova entra antes disso.*

- [ ] **[ARCH] Isolamento de Exportação**
    - [ ] Criar `services/export_service.py`.
    - [ ] Garantir que ZIP/TXT funcionem independente da Grid ou IA.
    - [ ] Testar exportação de 100 vídeos simultâneos.
- [ ] **[UI] Motor Virtual (wx.grid.PyGridTableBase)**
    - [ ] Implementar `VirtualTable` conectada ao `AppState`.
    - [ ] Remover lógica de armazenamento do `panel_grid.py`.
    - [ ] Validar scroll liso com 5.000 itens.
- [ ] **[DATA] Higiene e Compressão**
    - [ ] Adicionar compressão `zlib` nas transcrições (reduzir DB em 70%).
    - [ ] Script de VACUUM do SQLite para otimização periódica.

## 🔨 FASE 6: Insights e Resumos (Só após estabilidade)
- [ ] **[IA] Integração Opcional**
    - [ ] Implementar chamadas de IA como "Plugin" que pode falhar sem quebrar o app.
    - [ ] Botão "Gerar Resumo" manual (sob demanda).
- [ ] **[UI] Painel de Leitura**
    - [ ] Exibir resumo e transcrição lado a lado.

## 📦 FASE 7: Manutenção Zero
- [ ] **[OPS] Logs e Diagnóstico**
    - [ ] Logs automáticos de erros de download (yt-dlp).
    - [ ] Botão "Atualizar yt-dlp" na interface.