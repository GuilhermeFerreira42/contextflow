# Blueprint Atualizado — Fase 6.2c: Migração para Botões Genéricos + Estabilização de Tema

## 1. DIAGNÓSTICO CONFIRMADO

Os logs do `ThemeDebugger` confirmaram que restam **apenas 3 divergências**, todas em botões:

```
TabBatch/Button — atual=(240,240,240)  ← botão "Reset Safety" nativo
DialogConfig/Button — atual=(239,68,68) ← botão "Cancelar Todos" (vermelho intencional)
DialogConfig/Button — atual=(37,99,235) ← botão "Sincronizar & Salvar" (azul intencional)
```

**Conclusão**: Os botões vermelhos e azuis são **falsos positivos** — são cores intencionais (accent/danger). O único problema real é o botão `Reset Safety` na TabBatch que mantém cor `(240,240,240)` — cor padrão do Windows — em vez de receber a cor do tema.

Porém, analisando a screenshot, o DialogConfig inteiro permanece com fundo branco no dark mode. O auditor não pegou isso porque os painéis internos (ScrolledWindow, StaticBox) estão retornando a cor correta do sistema, mas visualmente o Windows renderiza branco por cima.

## 2. DECISÃO ESTRATÉGICA

Baseado na pesquisa do Gemini e na análise dos logs:

**Recomendo a Opção B (Híbrida)** com escopo cirúrgico:

1. Migrar botões de **ação principal** para `GenButton` (os que o usuário mais vê)
2. Aceitar limitações do DialogConfig (é modal, aberto raramente)
3. Adicionar o `ThemeDebugger` de forma permanente como filtro de validação

**Justificativa**: Os logs mostram que o sistema está 97% correto. Os 3% restantes são botões com cores intencionais (falsos positivos) e a limitação conhecida do Windows com StaticBox/Notebook interno do DialogConfig.

## 3. ARQUIVOS IMPACTADOS

| Arquivo | Mudança | Risco |
|---|---|---|
| `ui/tab_batch.py` | Migrar `btn_reset_safety` para GenButton | Baixo |
| `ui/tab_analysis.py` | Nenhuma — toolbar já usa cores corretas | Nenhum |
| `ui/dialog_config.py` | Adicionar propagação explícita nos ScrolledWindow | Baixo |
| `core/managers/theme_manager.py` | Adicionar método `apply_to_button()` | Baixo |
| `scripts/debug_theme.py` | Adicionar whitelist de cores intencionais | Baixo |

## 4. ESPECIFICAÇÕES TÉCNICAS

### 4.1 — `core/managers/theme_manager.py` — Novo método utilitário

Adicionar ao final da classe `ThemeManager`:

```python
    def apply_to_button(self, button, role="default"):
        """
        Aplica tema a um botão, tentando GenButton primeiro, fallback para nativo.
        
        Args:
            button: wx.Button ou GenButton
            role: "default", "accent", "danger", "cancel"
        """
        palette = {
            "default": (self.get_highlight_color(), self.get_fg_color()),
            "accent": (self.get_accent_color(), wx.WHITE),
            "danger": (wx.Colour(220, 53, 69), wx.WHITE),
            "cancel": (self.get_highlight_color(), wx.Colour(200, 50, 50)),
        }
        
        bg, fg = palette.get(role, palette["default"])
        
        try:
            button.SetBackgroundColour(bg)
            button.SetForegroundColour(fg)
            # GenButton precisa recalcular sombras
            if hasattr(button, 'InitColours'):
                button.InitColours()
            button.Refresh()
        except Exception:
            pass
```

### 4.2 — `ui/tab_batch.py` — Migrar botão problemático

**Bloco 1**: Adicionar import no topo do arquivo:

```python
# Adicionar após os imports existentes
from wx.lib.buttons import GenButton
```

**Bloco 2**: No método `_init_ui`, substituir APENAS a criação do `btn_reset_safety`:

```python
        # ANTES:
        # self.btn_reset_safety = wx.Button(self, label="Reset Safety")
        # self.btn_reset_safety.SetForegroundColour(wx.Colour(200, 50, 50))
        
        # DEPOIS:
        self.btn_reset_safety = GenButton(self, label="Reset Safety")
        self.btn_reset_safety.SetBackgroundColour(self.theme.get_highlight_color())
        self.btn_reset_safety.SetForegroundColour(wx.Colour(200, 50, 50))
        if hasattr(self.btn_reset_safety, 'InitColours'):
            self.btn_reset_safety.InitColours()
```

**Bloco 3**: No método `apply_theme`, na seção de botões genéricos, adicionar o `btn_reset_safety` à lista:

```python
    # Botões genéricos — substituir o bloco existente
    for btn in [self.btn_clear, self.btn_delete, self.btn_unify,
                self.btn_download_md, self.btn_export_zip,
                self.btn_reset_safety]:  # ← ADICIONADO
        try:
            btn.SetBackgroundColour(self.theme.get_highlight_color())
            btn.SetForegroundColour(fg)
            if hasattr(btn, 'InitColours'):
                btn.InitColours()
        except Exception:
            pass

    # Cancelar mantém vermelho
    self.btn_cancel.SetForegroundColour(wx.Colour(200, 50, 50))
    
    # Reset Safety mantém texto vermelho
    self.btn_reset_safety.SetForegroundColour(wx.Colour(200, 50, 50))
```

### 4.3 — `ui/dialog_config.py` — Propagação explícita para painéis internos

O DialogConfig é criado sob demanda e lê o tema no `__init__`. O problema é que os painéis internos dos tabs (ScrolledWindow) não herdam a cor do pai no Windows.

**Adicionar** ao final do método `_init_ui`, após `self.on_update_status(None)`:

```python
        self.on_update_status(None)  # já existe
        
        # [6.2c] Propagação forçada para painéis internos do Notebook
        self._propagate_bg_to_children()
    
    def _propagate_bg_to_children(self):
        """Força BackgroundColour nos filhos diretos que o Windows não propaga."""
        bg = self.theme.get_bg_color()
        fg = self.theme.get_fg_color()
        
        def _recurse(widget, depth=0):
            if depth > 10:  # Limite de segurança
                return
            try:
                # Pula widgets com cores intencionais
                if isinstance(widget, wx.Button):
                    return
                if isinstance(widget, wx.TextCtrl):
                    widget.SetBackgroundColour(self.theme.get_input_bg())
                    widget.SetForegroundColour(self.theme.get_input_fg())
                elif isinstance(widget, (wx.Panel, wx.ScrolledWindow)):
                    widget.SetBackgroundColour(bg)
                
                # StaticText — atualiza foreground
                if isinstance(widget, wx.StaticText):
                    # Preserva cores hardcoded intencionais (cinza, azul, vermelho)
                    current_fg = widget.GetForegroundColour()
                    is_hardcoded = (
                        current_fg == wx.Colour(100, 116, 139) or  # cinza info
                        current_fg == wx.Colour(37, 99, 235) or    # azul nota
                        current_fg.Red() > 180 and current_fg.Green() < 80  # vermelho
                    )
                    if not is_hardcoded:
                        widget.SetForegroundColour(fg)
                
            except Exception:
                pass
            
            for child in widget.GetChildren():
                _recurse(child, depth + 1)
        
        # Aplica nos 3 tabs do Notebook
        for i in range(self.nb.GetPageCount()):
            page = self.nb.GetPage(i)
            _recurse(page)
        
        # Header e action panel
        for child in self.GetChildren():
            if isinstance(child, wx.Panel) and child != self.nb:
                _recurse(child)
```

### 4.4 — `scripts/debug_theme.py` — Whitelist de cores intencionais

No método `audit`, na verificação de BG divergente, adicionar detecção de cores de botões intencionais. Substituir o bloco de detecção dentro do `else` do `is_console`:

```python
            if not bg_match:
                is_highlight = ThemeDebugger._colors_similar(actual_bg, theme_manager.get_highlight_color())
                is_accent = ThemeDebugger._colors_similar(actual_bg, theme_manager.get_accent_color())
                is_input = ThemeDebugger._colors_similar(actual_bg, theme_manager.get_input_bg())
                is_grid_bg = ThemeDebugger._colors_similar(actual_bg, theme_manager.get_grid_bg())
                is_border = ThemeDebugger._colors_similar(actual_bg, theme_manager.get_border_color())
                
                # [6.2c] Whitelist de cores intencionais para botões
                is_danger_btn = (actual_bg.Red() > 200 and actual_bg.Green() < 100 
                                and isinstance(window, wx.Button))
                is_accent_btn = ThemeDebugger._colors_similar(
                    actual_bg, theme_manager.get_accent_color()) and isinstance(window, wx.Button)
                is_save_btn = (actual_bg == wx.Colour(37, 99, 235) 
                              and isinstance(window, wx.Button))
                
                if not any([is_highlight, is_accent, is_input, is_grid_bg, 
                           is_border, is_danger_btn, is_accent_btn, is_save_btn]):
                    logger.warning(
                        f"{indent}[BG-DIVERGE] {widget_id} — "
                        f"atual=({actual_bg.Red()},{actual_bg.Green()},{actual_bg.Blue()}) "
                        f"esperado=({expected_bg.Red()},{expected_bg.Green()},{expected_bg.Blue()}) "
                        f"tipo={widget_name}"
                    )
```

## 5. ORDEM DE IMPLEMENTAÇÃO

1. `core/managers/theme_manager.py` — adicionar `apply_to_button()` 
2. `ui/tab_batch.py` — migrar `btn_reset_safety` para GenButton
3. `ui/dialog_config.py` — adicionar `_propagate_bg_to_children()`
4. `scripts/debug_theme.py` — adicionar whitelist
5. Testar: Light → Dark → abrir DialogConfig → fechar → Light → Dark

## 6. TESTE DE VALIDAÇÃO

Após implementar, o `ThemeDebugger` deve mostrar:

```
RESUMO DA AUDITORIA DE TEMA
  Tema ativo: dark
  Total widgets: ~150
  OK: ~148
  BG divergente: 0     ← ZERO é a meta
  FG divergente: 0
  Pulados: ~2
```

## 7. LIMITAÇÕES ACEITAS (Documentar)

```
F6.2c | RULE | wx.Notebook tabs no Windows | Texto das abas não aceita ForegroundColour | Limitação wxWidgets
F6.2c | RULE | wx.StaticBox frame labels | Rótulo do frame nativo no Windows | Limitação wxWidgets  
F6.2c | RULE | DialogConfig wx.StaticBox | Bordas/rótulos mantêm cor nativa | Limitação aceita
```

## 8. DECISÃO LOG

```
F6.2c | MOD | GenButton para btn_reset_safety | Botão nativo ignora SetBackgroundColour no Windows | ui/tab_batch.py
F6.2c | ADD | ThemeManager.apply_to_button() | Utilitário para aplicar tema a botões genéricos | core/managers/theme_manager.py
F6.2c | ADD | DialogConfig._propagate_bg_to_children() | Propagação forçada para ScrolledWindow internos | ui/dialog_config.py
F6.2c | MOD | ThemeDebugger whitelist | Falsos positivos em botões com cores intencionais | scripts/debug_theme.py
```

## 9. SUGESTÃO DE COMMIT

```
MIGRAÇÃO GENBUTTON E PROPAGAÇÃO FORÇADA NO DIALOGCONFIG — DARK MODE ESTÁVEL
```