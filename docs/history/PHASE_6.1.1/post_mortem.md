# Relatório Post-Mortem — Fase 6.1.1
**Data:** 28/02/2026  
**Escopo:** Governança Financeira, ThemeManager, UI Refinement  
**Status Final:** ✅ Homologado (22/22 testes)

---

## 1. Resumo Executivo

A Fase 6.1.1 introduziu novos componentes de infraestrutura (`CostLedger`, `ThemeManager`, `TokenEngine`) e refinamentos de UI (StatusChip agrupado, TelemetryStrip, Modo Pro). Durante a implementação, ocorreram falhas graves de integração que causaram **travamento total do boot** e **perda parcial da interface**. A recuperação exigiu instrumentação manual, uso de um backup completo do código pré-fase como referência, e múltiplas iterações de correção.

---

## 2. Cronologia dos Incidentes

### Incidente 1: TypeError no Boot (`AppWindow.__init__`)
- **Sintoma:** `TypeError: AppWindow.__init__() takes 1 positional argument but 2 were given`
- **Causa Raiz:** O refactor do `AppWindow` alterou a assinatura de `__init__` removendo o parâmetro `parent`, enquanto `main.py` passava `None` como argumento.
- **Impacto:** App não inicializava.
- **Solução:** Restaurar `def __init__(self, parent=None)`.

### Incidente 2: Tela Preta / Travamento Silencioso
- **Sintoma:** Terminal imprimia "Iniciando ContextFlow..." e travava sem erro. Janela não aparecia.
- **Causa Raiz:** A chamada `self.frame.Show()` foi acidentalmente removida de `main.py` durante o refactor do `AppWindow`.
- **Impacto:** App inicializava mas a janela principal nunca era exibida.
- **Resolução:** Adição de `self.frame.Show()` em `main.py`. Posteriormente, ao restaurar o código original, `Show()` voltou para dentro de `AppWindow.__init__()` onde é o local correto.
- **Horas gastas em debug:** ~2h (adição de prints de debug em cascata: AppState → AppWindow → TabAnalysis → WebView).

### Incidente 3: UI Parcialmente Restaurada
- **Sintoma:** App abriu mostrando apenas 2 abas (Doca de Carga, Cockpit Analítico), sem Sidebar, sem Aba 3 (Leitor), sem Toolbar, sem MenuBar, sem Console.
- **Causa Raiz:** O `AppWindow` reescrito para a Fase 6.1.1 foi simplificado demais — apenas um `SplitterWindow` com `Notebook(2 abas)` e `ConsolePanel`. Toda a arquitetura original (Sidebar com SplitterWindow aninhado, 3 abas, Toolbar com StatusChip, MenuBar com menus Arquivo/Exibir/Ferramentas, Processor, etc.) foi perdida.
- **Impacto:** Sistema funcional mas com ~60% da interface ausente.
- **Resolução:** O usuário forneceu o arquivo `codigo_completo.txt` (backup pré-6.1.1, 7.780 linhas). A partir dele, o `AppWindow` original foi localizado (linhas 4405-4665) e restaurado integralmente, incorporando apenas os acréscimos da Fase 6.1.1 (ThemeManager, Maximize robusta).

---

## 3. Análise de Causa Raiz

### Por que a IA perdeu componentes durante o refactor?

1. **Contexto Fragmentado:** O `AppWindow` original tinha 260+ linhas com dependências cruzadas (Sidebar, Processor, DialogConfig, StatusChip, MenuBar, Toolbar). A IA reescreveu o arquivo inteiro em vez de fazer edits cirúrgicos, perdendo componentes que não estavam em foco.

2. **Ausência de Snapshot de Referência:** Sem um snapshot estável para comparação, a IA não tinha como verificar se o novo código cobria 100% das funcionalidades do original. O `codigo_completo.txt` fornecido pelo usuário foi essencial para resolver o problema.

3. **Reescrita Completa vs. Edição Incremental:** O padrão `write_to_file` com `Overwrite=true` em um arquivo de 260 linhas é arriscado. Edições com `replace_file_content` em blocos específicos preservariam o restante do arquivo.

4. **Falta de Testes de Regressão de UI:** Não existia um teste automatizado que verificasse "AppWindow tem Sidebar + 3 abas + Console + Toolbar + MenuBar". A ausência de componentes só foi detectada visualmente pelo usuário.

---

## 4. O Papel do Backup (`codigo_completo.txt`)

O arquivo de backup provido pelo usuário foi **decisivo** para a recuperação. Sem ele:
- A reconstrução do `AppWindow` teria sido baseada em documentação fragmentada (DOC.md) e inferência, com alto risco de erros adicionais.
- O código original continha lógica de integração não-documentada (ex: `Processor.start_processing()` no init, `self.item_view_sidebar.Check(True)` sincronizado com toggles) que seria impossível recriar apenas pela documentação.

### Recomendação para a Metodologia
> **Antes de iniciar qualquer fase que modifique arquivos-chave (>100 linhas), gerar um snapshot completo do sistema (ex: `git tag fase-X-pre` ou cópia do código completo) e referenciá-lo explicitamente no prompt da IA.**

---

## 5. Dificuldades Específicas da Programação com IA

| Dificuldade | Descrição | Lição Aprendida |
|-------------|-----------|-----------------|
| **Perda de Contexto** | A IA não "lembra" do estado completo de arquivos grandes. Ao reescrever `app_window.py`, perdeu Sidebar, MenuBar, Toolbar, Processor. | Nunca usar `Overwrite=true` em arquivos >100 linhas sem revisar diffs. Preferir edições cirúrgicas. |
| **Debugging Cego** | A IA não vê a tela. O boot travava silenciosamente e a IA precisou adicionar ~15 prints de debug para localizar o ponto exato. | Pedir ao usuário para colar o output completo do terminal a cada iteração. Instrumentar com prints em cascata. |
| **Efeitos Colaterais Invisíveis** | Remover `self.frame.Show()` causou boot "bem sucedido" mas sem janela. A IA não percebeu a omissão. | Checklist de "partes essenciais" para cada arquivo: `Show()`, `return True`, `self.SetSizer()`, etc. |
| **Encoding Windows** | `Select-String` e `grep_search` falharam na busca dentro do `codigo_completo.txt` devido a encoding UTF-8 com BOM (ou similar). | Usar PowerShell `Select-String -Encoding utf8` ou criar scripts Python para busca textual. |
| **Cascata de Erros** | A primeira correção (fix TypeError) revelou o segundo bug (Show ausente), que revelou o terceiro (UI incompleta). Cada fix gerou uma nova sessão de debug. | Após qualquer refactor grande, fazer uma varredura de integridade: importações, instanciamentos, layouts, eventos. |

---

## 6. Recomendações para a Metodologia de IA+Programação

### 6.1 Antes da Implementação
- [ ] **Git tag ou snapshot** do código estável atual
- [ ] **Inventário de integridade**: listar todos os componentes do arquivo-alvo (ex: "AppWindow: Sidebar, 3 abas, Console, Toolbar, MenuBar, Processor, 12 event handlers")
- [ ] **Delimitar escopo**: instruir a IA para **adicionar/modificar** blocos específicos, não reescrever arquivos inteiros

### 6.2 Durante a Implementação
- [ ] **Edições cirúrgicas**: usar `replace_file_content` com blocos pequenos em vez de `write_to_file` com `Overwrite`
- [ ] **Validação incremental**: rodar o app após cada arquivo modificado, não apenas no final
- [ ] **Prints de diagnóstico temporários**: adicionar no início de cada método crítico (init, boot, layout)

### 6.3 Após a Implementação
- [ ] **Diff review**: comparar o arquivo modificado com o backup para detectar omissões
- [ ] **Checklist visual**: confirmar presença de cada componente de UI (abas, painéis, menus, toolbar)
- [ ] **Stress test**: rodar teste de carga para confirmar que a performance não degradou
- [ ] **Relatório post-mortem**: documentar incidentes para retroalimentar a metodologia

### 6.4 Anti-Padrões Identificados
| ❌ Anti-Padrão | ✅ Padrão Correto |
|---------------|-------------------|
| Reescrever arquivo inteiro com `Overwrite=true` | Editar blocos específicos com `replace_file_content` |
| Confiar que a IA "lembrou" de todos os componentes | Fornecer inventário de integridade no prompt |
| Debugar apenas pelo terminal (sem ver a tela) | Pedir screenshot ou descrição visual detalhada do usuário |
| Corrigir e testar tudo no final | Testar após cada arquivo modificado |
| Começar sem backup | Sempre fazer `git tag` ou snapshot antes de cada fase |

---

## 7. Métricas da Sessão

| Métrica | Valor |
|---------|-------|
| Duração total da sessão | ~3h30m |
| Tempo gasto em debug de boot | ~2h |
| Tempo gasto em restauração de UI | ~45min |
| Tempo gasto em correções de auditoria | ~30min |
| Arquivos modificados | 5 (`app_window.py`, `main.py`, `app_state.py`, `tab_analysis.py`, `status_chip.py`, `token_engine.py`) |
| Iterações de "roda o app e me diz" | 8 |
| Prints de debug adicionados e depois removidos | 15 |
| Uso de backup como referência | Sim (decisivo para restauração) |
| Taxa final de homologação | 22/22 (100%) |

---

## 8. Conclusão

A Fase 6.1.1 alcançou todos os seus objetivos técnicos (CostLedger, ThemeManager, StatusChip agrupado, Modo Pro, TokenEngine nativo). No entanto, o processo de implementação revelou fragilidades importantes na metodologia de programação com IA, especialmente em relação a **reescritas destrutivas** e **debugging remoto sem acesso visual**. 

O principal aprendizado é que **a IA funciona melhor como bisturi do que como marreta**: edições cirúrgicas em blocos específicos são seguras; reescritas completas de arquivos complexos são arriscadas. O uso de snapshots de referência e inventários de integridade devem ser incorporados como práticas obrigatórias no workflow.
