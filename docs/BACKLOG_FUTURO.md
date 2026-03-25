# 🗺️ BACKLOG FUTURO — ContextFlow Video AI

> **Última atualização:** Fase 7 (pós-implementação completa das Fases 1–6)
> **Total de melhorias mapeadas:** 18 itens em 5 fases
> **Critérios de priorização:** Impacto imediato → Risco técnico → Dependências entre itens

---

## 📊 Visão Geral das Fases

| Fase | Foco | Itens | Risco | Estimativa |
|------|------|-------|-------|------------|
| **7.1** | Quick Wins — UX & Interface | 6 | 🟢 Baixo | ~1–2 dias |
| **7.2** | Grid — Seleção & Navegação | 4 | 🟡 Médio | ~2–3 dias |
| **7.3** | Controles de IA — Configuração | 4 | 🟡 Baixo/Médio | ~3–4 dias |
| **7.4** | Qualidade — Map-Reduce & Estabilidade | 2 | 🔴 Alto | ~4–5 dias |
| **7.5** | Novos Módulos — Galeria & Orquestração | 2 | 🔴 Alto | ~5–7 dias |

---

## 🟢 FASE 7.1: Quick Wins (Correções Visuais Isoladas)

> Itens independentes entre si, cada um em arquivo distinto, sem dependência de lógica de negócio.
> Validação visual imediata após cada implementação.

### 7.1.1 — Correção de Tema na Aba de Detalhes (Aba 3)
- **Problema:** Ao trocar o tema, a aba 3 permanece com o tema antigo. Só atualiza ao selecionar outro vídeo.
- **Causa raiz:** O método `apply_theme()` do `DetailPanel` atualiza cores do painel wx, mas NÃO recarrega o HTML do WebView com o novo tema.
- **Arquivo:** `ui/panels/panel_detail.py`
- **Solução:** Guardar o `video_id` atual em cache no painel. No `apply_theme()`, verificar se há vídeo ativo e chamar `_reload_current_video()` para reinjetar o HTML com as cores do novo tema.
- **Risco:** 🟢 Nenhum. Alteração isolada em um único arquivo.
- **Impacto:** Corrige comportamento confuso e imediato na interface.

### 7.1.2 — Expansão de Thumbnail ao Clicar
- **Problema:** A imagem da aba 3 é estática e pequena, sem possibilidade de ampliar.
- **Causa raiz:** `img_thumb` é um `wx.StaticBitmap` sem handler de clique.
- **Arquivo:** `ui/panels/panel_detail.py`
- **Solução:** Bind `EVT_LEFT_UP` no `StaticBitmap` para abrir um `wx.Dialog` modal com a imagem em tamanho real (ou escalada para caber na tela).
- **Risco:** 🟢 Nenhum. Adição de funcionalidade sem alterar fluxo existente.
- **Impacto:** Melhora a experiência de revisão visual do conteúdo.

### 7.1.3 — Ícone de Configurações na Toolbar
- **Problema:** As configurações só são acessíveis via menu ou atalho. Falta acesso direto visual.
- **Causa raiz:** A toolbar do `app_window.py` tem apenas o toggle de tema.
- **Arquivos:** `ui/app_window.py`, `ui/dialogs/dialog_config.py`
- **Solução:** Inserir botão com ícone de engrenagem (⚙) na barra superior, ao lado do toggle de tema. Ao clicar, abrir o `ConfigDialog` existente.
- **Risco:** 🟢 Nenhum. O dialog já existe e funciona.
- **Impacto:** Acesso mais rápido e intuitivo às configurações.

### 7.1.4 — Botões Expandir/Recolher na Sidebar
- **Problema:** Não há como expandir ou colapsar todas as playlists de uma vez na árvore lateral.
- **Causa raiz:** O `TreeCtrl` da sidebar não expõe controles de expansão em massa.
- **Arquivo:** `ui/sidebar.py`
- **Solução:** Adicionar dois botões pequenos (▶ Expandir Tudo / ▼ Recolher Tudo) acima da árvore, chamando `tree.ExpandAll()` e `tree.CollapseAll()`.
- **Risco:** 🟢 Nenhum. Métodos nativos do `wx.TreeCtrl`.
- **Impacto:** Navegação mais eficiente em bibliotecas grandes.

### 7.1.5 — CTA Visual para Resumos Vazios
- **Problema:** Quando não há resumo, a coluna exibe um traço "—" que não comunica ação possível.
- **Causa raiz:** O renderer da coluna de resumo usa texto estático para o estado vazio.
- **Arquivo:** `ui/components/virtual_table.py`
- **Solução:** Substituir "—" por "✦ Resumir" em cor de destaque (azul do tema) indicando que é uma ação disponível.
- **Risco:** 🟢 Nenhum. Alteração puramente visual no renderer.
- **Impacto:** Convida o usuário à ação e melhora a comunicação visual.

### 7.1.6 — Remoção da Coluna Status na Aba de Análise (Aba 2)
- **Problema:** A coluna "Status" na aba de análise é redundante — todos os itens ali já estão com status "completed".
- **Causa raiz:** A coluna foi herdada da aba de downloads onde faz sentido, mas na aba de análise não agrega valor.
- **Arquivo:** `ui/tabs/tab_analysis.py`
- **Solução:** Remover a coluna "Status" e redistribuir o espaço para colunas mais úteis (ex: "Duração" ou "Canal").
- **Risco:** 🟢 Baixo. Verificar se algum handler referencia essa coluna por índice.
- **Impacto:** Mais espaço para informações relevantes.

---

## 🔵 FASE 7.2: Comportamento da Grid (Navegação Profissional)

> Grupo de itens interdependentes que alteram o mecanismo de seleção da `wx.grid`.
> ⚠️ IMPORTANTE: Itens #7.2.1 e #7.2.2 devem ser implementados JUNTOS como refactor único.

### 7.2.1 — Destaque de Linha Inteira na Navegação por Teclado
- **Problema:** Ao navegar com setas, o foco fica em célula individual em vez da linha toda.
- **Causa raiz:** O `VirtualVideoTable` só aplica fundo de seleção quando detecta linha inteira selecionada. A navegação por teclado seleciona apenas a célula.
- **Arquivos:** `ui/components/virtual_table.py`, `ui/tabs/tab_downloads.py`, `ui/tabs/tab_analysis.py`
- **Solução:** Forçar `SelectRow(row)` no handler `EVT_GRID_SELECT_CELL` com guard flag `_is_programmatic_selection` para evitar loops de evento.
- **⚠️ Conflito:** Na aba 1, a coluna 0 tem checkbox. O `SelectRow()` NÃO pode interferir no toggle do checkbox. Precisa de guarda: `if col != 0: SelectRow(row)`.
- **Risco:** 🟡 Médio. Loops de evento e conflito com checkbox.
- **Impacto:** Navegação profissional consistente com ferramentas desktop de referência.

### 7.2.2 — Bloqueio de Seleção Acidental de Caracteres
- **Problema:** Ao clicar/arrastar nas colunas de status, resumo ou link na aba 2, os caracteres são selecionados individualmente.
- **Causa raiz:** Renderers personalizados não bloqueiam a seleção de texto padrão do `wx.grid`. As células se comportam como editáveis.
- **Arquivos:** `ui/components/virtual_table.py`
- **Solução:** Implementar junto com #7.2.1. Capturar `EVT_GRID_RANGE_SELECT` e suprimir seleção parcial. Desabilitar editores para células não-editáveis:
  ```python
  def CreateEditor(self, grid, row, col):
      return None  # Sem editor = sem seleção de texto
  ```
- **Risco:** 🟡 Médio. Mesmo sistema de eventos do #7.2.1.
- **Impacto:** Remove frustração na interação com a grid.

### 7.2.3 — Persistência de Seleção Azul (Foco Perdido)
- **Problema:** A seleção azul vira cinza ao clicar fora da grid. Na aba 1, o destaque permanece só em algumas colunas.
- **Causa raiz:** Comportamento nativo do wxWidgets para seleção em estado inativo.
- **Arquivo:** `ui/components/virtual_table.py`
- **Solução:** Sobrescrever `GetAttr()` para manter cor de seleção via lógica do `ThemeManager` independente do estado de foco. Usar `SetSelectionBackground()` para estados ativos e inativos.
- **Risco:** 🟡 Médio. Interação com o sistema de temas.
- **Impacto:** Clareza visual sobre qual item está selecionado em qualquer momento.

### 7.2.4 — Cursor Hand em Elementos Clicáveis
- **Problema:** Falta do cursor "mãozinha" ao passar sobre ícones, links e elementos clicáveis.
- **Causa raiz:** Renderers de ícones e links não alteram o cursor no hover.
- **Arquivo:** `ui/components/virtual_table.py`
- **Solução:** Implementar `EVT_GRID_MOTION` (ou `EVT_MOTION` no grid window) para alterar o cursor ao passar sobre colunas de Link, Preview, e áreas clicáveis da coluna Resumo.
- **Risco:** 🟢 Baixo. Evento independente da seleção.
- **Impacto:** Feedback visual imediato de interatividade (affordance).

---

## 🟡 FASE 7.3: Controles de IA (Customização do Processamento)

> Expansão das capacidades de configuração sem alterar o executor principal.
> ⚠️ IMPORTANTE: Implementar #7.3.2 ANTES do Map-Reduce (Fase 7.4) para evitar refatoração dupla.

### 7.3.1 — Regerar Resumo
- **Problema:** Não é possível reprocessar vídeos já marcados como concluídos de forma intuitiva.
- **Causa raiz:** O fluxo atual marca como "completed" e o cache impede reprocessamento.
- **Arquivos:** `ui/tabs/tab_analysis.py`, `services/ai/ai_cache_manager.py`
- **Solução:** Adicionar "↺ Regerar Resumo" no menu de contexto (botão direito). Enviar flag `force=True` para o executor, que ignora o `AICacheManager` e sobrescreve o resultado.
- **Risco:** 🟢 Baixo. O mecanismo de cache já suporta invalidação.
- **Impacto:** Permite melhorar resumos insatisfatórios sem workarounds.

### 7.3.2 — Instruções Personalizadas (Prompt do Usuário)
- **Problema:** O resumo é gerado com prompt fixo. O usuário não pode definir estilo (ex: "em tópicos", "em inglês", "foco em código").
- **Causa raiz:** Não existe campo `custom_instructions` no fluxo de configuração → prompt.
- **Arquivos:** `ui/dialogs/dialog_config.py`, `services/ai/ai_executor.py`, `services/ai/ai_cache_manager.py`
- **Solução:**
  1. Adicionar campo `custom_instructions` no `ConfigDialog` (textarea).
  2. Salvar nas configurações persistentes.
  3. Injetar no prompt antes do envio à API no `AIExecutor`.
  4. **⚠️ CRÍTICO:** Adicionar `custom_instructions` ao checksum do `AICacheManager`. Atualmente o hash usa apenas `video_id + provider + model`. Sem isso, o cache retorna resumo antigo com prompt novo.
  ```python
  # ai_cache_manager.py — CORREÇÃO NECESSÁRIA
  cache_key = hashlib.md5(
      f"{video_id}:{provider}:{model}:{custom_instructions}".encode()
  ).hexdigest()
  ```
- **Risco:** 🟡 Médio. Invalidação de cache existente.
- **Impacto:** Personalização total da saída da IA.

### 7.3.3 — Toggle de Deep Thinking
- **Problema:** Modelos como Qwen ou Gemini 2.0 demoram muito devido ao raciocínio interno (chain-of-thought).
- **Causa raiz:** Não há controle para desabilitar o pensamento profundo.
- **Arquivos:** `ui/dialogs/dialog_config.py`, `services/ai/ai_executor.py`
- **Solução:** Adicionar checkbox "Pensamento Profundo" nas configurações de IA. Quando desabilitado:
  - **Qwen (Ollama):** Injetar `/no_think` no prompt.
  - **Gemini (Google):** Configurar `thinkingBudget: 0` na chamada da API.
  - **Outros modelos:** Ignorar (sem efeito).
- **⚠️ Nota:** São implementações DIFERENTES por provider. Precisa de abstração no executor.
- **Risco:** 🟡 Médio. Lógica condicional por provider.
- **Impacto:** Reduz latência significativamente para tarefas simples de resumo.

### 7.3.4 — Cronômetro de Tempo de Processamento
- **Problema:** Não há feedback de quanto tempo a IA está levando para processar.
- **Causa raiz:** O fluxo atual mostra apenas o status "processando..." sem referência temporal.
- **Arquivos:** `ui/app_window.py` (status bar), `services/task_manager.py`
- **Solução:** Timer de 1s ativado via PubSub `SUMMARY_STARTED`, incrementando contagem na status bar. Para ao receber `SUMMARY_COMPLETED`. Exibe tempo total no final.
- **Sugestão de local:** Na status bar existente, não em novo componente.
- **Risco:** 🟢 Baixo. Timer independente.
- **Impacto:** Feedback essencial para modelos lentos.

---

## 🔴 FASE 7.4: Qualidade de Resumo e Estabilidade (Núcleo do Produto)

> Fase crítica que resolve os problemas fundamentais de vídeos longos e performance local.
> ⚠️ Pré-requisito: Implementar `get_context_size(provider, model)` como interface unificada.

### 7.4.1 — Estabilidade e Performance do Ollama
- **Problema:** Lentidão e travamentos na UI ao usar modelos locais via Ollama.
- **Causa raiz:** Modelos locais são processados com `requests.post()` síncrono em thread. O `wx.CallAfter` é chamado token por token, sobrecarregando o event loop da UI.
- **Arquivos:** `services/ai/ai_executor.py`, `services/task_manager.py`
- **Solução:**
  1. Implementar streaming real com `requests.stream=True`.
  2. Adicionar batching no update da UI:
     ```python
     buffer = []
     if len(buffer) >= 10 or is_final:
         wx.CallAfter(update_ui, "".join(buffer))
         buffer.clear()
     ```
  3. Permitir cancelamento mid-stream via flag compartilhada na thread.
- **Risco:** 🔴 Alto. Alteração no fluxo de comunicação thread ↔ UI.
- **Impacto:** Remove travamentos em máquinas com GPU limitada.

### 7.4.2 — Map-Reduce Automático para Vídeos Longos
- **Problema:** Vídeos longos (podcasts de 2h+) geram resumos curtos e insatisfatórios porque a transcrição estoura o contexto do modelo.
- **Causa raiz:** O executor envia a transcrição inteira como prompt único. Modelos com 32k tokens descartam o excedente.
- **Arquivos:** `services/ai/ai_executor.py`, `core/constants.py` (já contém `SUMMARY_MAP_PROMPT` e `SUMMARY_REDUCE_PROMPT`)
- **Solução:**
  1. **Pré-requisito:** Criar interface `get_context_size(provider, model)`:
     - Ollama: via `/api/show` endpoint.
     - Google: via metadata da API.
     - OpenAI: via lookup table hardcoded.
  2. **Lógica de decisão:**
     ```
     SE tokens_da_transcricao > (contexto_do_modelo * 0.6):
         USAR fluxo Map-Reduce
     SENÃO:
         USAR prompt único (comportamento atual)
     ```
  3. **Estratégia de lançamento:** Implementar primeiro como modo *opt-in* ("Resumo Detalhado" no menu de contexto) antes de ativar como fallback automático.
- **⚠️ Dependência:** O `custom_instructions` da Fase 7.3.2 DEVE estar implementado antes, porque o prompt customizado precisa ser aplicado tanto no passo Map quanto no Reduce.
- **Risco:** 🔴 Alto. Qualidade do Reduce depende de calibração do prompt.
- **Impacto:** Resolve o problema #1 de valor do produto — resumos de qualidade para qualquer duração.

---

## 🟣 FASE 7.5: Novos Módulos (Expansão do Produto)

> Componentes arquiteturais novos. Só faz sentido com todas as fases anteriores estáveis.

### 7.5.1 — Módulo de Galeria (Visualização de Cards)
- **Problema:** Não existe uma visão de "leitura" focada na revisão de conhecimento acumulado.
- **Causa raiz:** O sistema foi construído como ferramenta de processamento, não de consulta.
- **Arquivo novo:** `ui/tabs/tab_gallery.py`
- **Solução:** Nova aba com `wx.ScrolledWindow` virtualizado exibindo cards com:
  - Thumbnail grande
  - Título, tags, canal
  - Preview do resumo (primeiras 3 linhas)
  - Filtros por canal, playlist ou vídeos individuais
- **⚠️ Performance:** Lazy loading obrigatório para thumbnails. Não carregar todas as imagens de uma vez.
- **Risco:** 🔴 Alto. Componente novo com scroll virtualizado e carregamento assíncrono.
- **Impacto:** Transforma o app em ferramenta de revisão de conhecimento.

### 7.5.2 — Orquestração Multi-Agente
- **Problema:** Vídeos extremamente longos ou complexos poderiam se beneficiar de processamento paralelo.
- **Causa raiz:** O Map-Reduce da Fase 7.4 é sequencial — um chunk por vez.
- **Arquivo novo:** `services/ai/ai_orchestrator.py`
- **Solução:** Criar orquestrador que distribui chunks para processamento paralelo:
  - **Cloud (Google/OpenAI):** Chamadas paralelas via `asyncio` ou `ThreadPoolExecutor`.
  - **Ollama local:** Manter sequencial (GPU compartilhada, paralelismo causa OOM).
  - Um agente orquestrador faz o Reduce final.
- **⚠️ Dependência:** Requer Map-Reduce da Fase 7.4 estável e validado.
- **Risco:** 🔴 Alto. Controle de concorrência e merge de resultados.
- **Impacto:** Reduz tempo de processamento para 1/N em providers Cloud.

---

## 📋 Matriz de Dependências

```
7.1.1 ─── independente
7.1.2 ─── independente
7.1.3 ─── independente
7.1.4 ─── independente
7.1.5 ─── independente
7.1.6 ─── independente

7.2.1 ◄── deve ser implementado JUNTO com 7.2.2
7.2.2 ◄── deve ser implementado JUNTO com 7.2.1
7.2.3 ─── após 7.2.1/7.2.2
7.2.4 ─── independente (pode ser feito em paralelo)

7.3.1 ─── independente
7.3.2 ◄── DEVE ser implementado ANTES de 7.4.2
7.3.3 ─── independente
7.3.4 ─── independente

7.4.1 ─── independente
7.4.2 ◄── depende de 7.3.2

7.5.1 ◄── depende de 7.4.2 (resumos de qualidade)
7.5.2 ◄── depende de 7.4.2 (Map-Reduce estável)
```

---

## 📝 Notas Técnicas Gerais

1. **Cache do AICacheManager:** O checksum atual usa `video_id + provider + model`. Qualquer campo novo que afete o resultado (custom_instructions, deep_thinking) DEVE ser adicionado ao hash.

2. **wx.grid vs. seleção:** O `wx.grid.Grid` não foi projetado para seleção de linha inteira com navegação por teclado. Todos os itens da Fase 7.2 compartilham o mesmo mecanismo de eventos — por isso devem ser tratados como um refactor único do sistema de seleção.

3. **Providers diferentes, APIs diferentes:** Deep Thinking (#7.3.3) e Context Size (#7.4.2) requerem implementações específicas por provider. O `AIExecutor` precisa de abstração para esses controles.

4. **Performance da Galeria:** O `wx.ScrolledWindow` com muitos cards requer virtualização. Renderizar apenas o que está visível no viewport.
