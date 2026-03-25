# Blueprint — Fase 6.2d Correções Finais de Contraste e Inicialização do Dark Mode

## Problemas Identificados

Baseado no seu relato, existem **3 problemas distintos**:

### Problema 1: Legendas pretas no tema escuro
Textos como o ícone do botão ☰ na sidebar e labels no DialogConfig permanecem com `ForegroundColour` preto, tornando-os ilegíveis no fundo escuro.

### Problema 2: Inicialização com tema errado
Quando o app inicia com `theme: "dark"` salvo no `credentials.json`, algumas telas (como a Aba 1 — Doca de Carga) iniciam com fundo branco. O `apply_theme` só é chamado na **troca** de tema via PubSub, mas não na **inicialização**.

### Problema 3: Necessidade de ciclo Light→Dark para corrigir
Isso confirma que o `__init__` dos componentes usa cores hardcoded (branco) em vez de consultar o ThemeManager na construção.

## Causa Raiz

**Problema 1**: Os construtores dos widgets usam `SetForegroundColour` apenas para cores especiais (vermelho, azul), mas não aplicam `fg` do tema para widgets genéricos.

**Problema 2 e 3**: Os componentes são construídos com `self.theme.get_bg_color()` no `__init__`, o que funciona. MAS: widgets filhos criados DENTRO de `_init_ui()` usam cores hardcoded como `wx.Colour(230, 230, 230)` ou `wx.Colour(220, 220, 220)` em vez de chamar o tema.

## Correções Cirúrgicas

### Arquivo 1: `ui/app_window.py` — Aplicar tema na inicialização

No método `__init__`, **após** `self.Show(True)` e **antes** do `self.log_to_console`, adicionar:

```python
        self.Maximize()
        self.Show(True)
        
        # [6.2d] Aplica tema na inicialização se dark mode está salvo
        if self.theme.get_theme_name() == "dark":
            wx.CallAfter(self._apply_initial_theme)
        
        self.log_to_console("Sistema iniciado sob a Lei da Estabilidade (Fase 5.7).", "SYSTEM")
```

E adicionar o novo método:

```python
    def _apply_initial_theme(self):
        """[6.2d] Aplica tema escuro na inicialização quando persistido."""
        bg = self.theme.get_bg_color()
        fg = self.theme.get_fg_color()
        border = self.theme.get_border_color()
        
        self.SetBackgroundColour(bg)
        self.nb_container.SetBackgroundColour(bg)
        
        try:
            self.notebook.SetBackgroundColour(bg)
            self.notebook.SetForegroundColour(fg)
        except Exception:
            pass
        
        try:
            self.main_splitter.SetBackgroundColour(border)
            self.right_splitter.SetBackgroundColour(border)
        except Exception:
            pass
        
        for comp in [self.sidebar, self.tab_batch, self.tab_analysis,
                     self.panel_detail, self.panel_console]:
            try:
                if hasattr(comp, 'apply_theme'):
                    comp.apply_theme()
            except Exception:
                pass
        
        self.Refresh()
        self.Update()
```

### Arquivo 2: `ui/sidebar.py` — Corrigir botão ☰ e header

No método `_init_ui`, o botão `btn_toggle` tem texto preto hardcoded. Adicionar ForegroundColour do tema:

No bloco de criação do `btn_toggle` (dentro de `_init_ui`), **após** a linha `self.btn_toggle.SetBackgroundColour(...)`, adicionar:

```python
        self.btn_toggle.SetForegroundColour(self.theme.get_fg_color())
```

E para o label "Histórico", **após** `header_lbl.SetFont(...)`, adicionar:

```python
        header_lbl.SetForegroundColour(self.theme.get_fg_color())
```

No método `apply_theme`, adicionar atualização do FG do botão toggle:

```python
    def apply_theme(self):
        """[FASE 6.2d] Atualiza cores internas da Sidebar."""
        self.theme = ThemeManager()
        bg = self.theme.get_bg_color()
        fg = self.theme.get_fg_color()

        self.SetBackgroundColour(bg)
        self.tree.SetBackgroundColour(bg)
        self.tree.SetForegroundColour(fg)
        self.btn_toggle.SetBackgroundColour(self.theme.get_border_color())
        self.btn_toggle.SetForegroundColour(fg)  # [6.2d] FG do botão ☰

        if hasattr(self, 'search_ctrl'):
            self.search_ctrl.SetBackgroundColour(self.theme.get_input_bg())
            self.search_ctrl.SetForegroundColour(self.theme.get_input_fg())

        for child in self.GetChildren():
            if isinstance(child, wx.StaticText):
                child.SetBackgroundColour(bg)
                child.SetForegroundColour(fg)

        try:
            self.load_history(self.search_ctrl.GetValue())
        except Exception:
            pass

        self.Refresh()
```

### Arquivo 3: `ui/tab_batch.py` — Corrigir inicialização

No método `_init_ui`, o `btn_close_viewer` e outros widgets usam cores hardcoded. Trocar:

Na linha do `self.grid.SetGridLineColour(...)`, substituir `wx.Colour(220, 220, 220)` por chamada ao tema:

```python
        # ANTES:
        # self.grid.SetGridLineColour(wx.Colour(220, 220, 220))
        # DEPOIS:
        self.grid.SetGridLineColour(self.theme.get_border_color())
```

Também no input de texto, aplicar cores do tema na inicialização. Após `self.txt_input.SetHint(...)`:

```python
        self.txt_input.SetBackgroundColour(self.theme.get_input_bg())
        self.txt_input.SetForegroundColour(self.theme.get_input_fg())
```

### Arquivo 4: `ui/tab_analysis.py` — Corrigir grid line color hardcoded

Mesmo problema que tab_batch. Na linha `self.grid.SetGridLineColour(wx.Colour(220, 220, 220))`:

```python
        # ANTES:
        # self.grid.SetGridLineColour(wx.Colour(220, 220, 220))
        # DEPOIS:
        self.grid.SetGridLineColour(self.theme.get_grid_line())
```

E o botão `btn_close_viewer` na inicialização:

```python
        # ANTES:
        # self.btn_close_viewer.SetBackgroundColour(wx.Colour(230, 230, 230))
        # DEPOIS:
        self.btn_close_viewer.SetBackgroundColour(self.theme.get_highlight_color())
        self.btn_close_viewer.SetForegroundColour(self.theme.get_fg_color())
```

### Arquivo 5: `ui/panel_detail.py` — WebView inicialização

No método `_init_ui`, o browser injeta fundo branco hardcoded. Substituir:

```python
        # ANTES:
        # self.browser.SetPage("<html><body style='background-color:white;'></body></html>", "")
        # DEPOIS:
        bg_hex = self.theme.get_bg_color().GetAsString(wx.C2S_HTML_SYNTAX)
        self.browser.SetPage(f"<html><body style='background-color:{bg_hex};'></body></html>", "")
```

E o fallback txt_content:

```python
        # ANTES:
        # self.txt_content.SetBackgroundColour(wx.WHITE)
        # self.txt_content.SetForegroundColour(wx.Colour(40, 40, 40))
        # DEPOIS:
        self.txt_content.SetBackgroundColour(self.theme.get_bg_color())
        self.txt_content.SetForegroundColour(self.theme.get_fg_color())
```

### Arquivo 6: `ui/components/analysis_toolbar.py` — Labels na inicialização

No `_init_ui`, o `lbl_provider` e `lbl_ai_status` não recebem FG do tema. Após cada `SetFont`:

```python
        lbl_provider.SetForegroundColour(self.theme.get_fg_color())
```

E o botão export:

```python
        # ANTES:
        # self.btn_export.SetBackgroundColour(wx.Colour(230, 230, 230))
        # DEPOIS:
        self.btn_export.SetBackgroundColour(self.theme.get_highlight_color())
        self.btn_export.SetForegroundColour(self.theme.get_fg_color())
```

## Resumo de Todas as Mudanças

| Arquivo | Mudança | Problema Resolvido |
|---|---|---|
| `ui/app_window.py` | `_apply_initial_theme()` no `__init__` | Inicialização dark |
| `ui/sidebar.py` | FG do botão ☰ e label "Histórico" | Botão invisível |
| `ui/tab_batch.py` | Grid line color + input bg/fg do tema | Aba 1 branca na inicialização |
| `ui/tab_analysis.py` | Grid line + btn_close_viewer do tema | Cores hardcoded |
| `ui/panel_detail.py` | WebView bg hex do tema | Flash branco |
| `ui/components/analysis_toolbar.py` | Labels + export btn do tema | Legendas pretas |

## Decisão Log

```
F6.2d | BUGFIX | Inicialização dark mode | apply_theme chamado no __init__ quando theme=dark | ui/app_window.py
F6.2d | BUGFIX | Botão ☰ invisível | FG hardcoded preto → tema dinâmico | ui/sidebar.py
F6.2d | BUGFIX | Cores hardcoded em _init_ui | wx.Colour(230,230,230) → theme.get_highlight_color() | ui/tab_batch.py, ui/tab_analysis.py
F6.2d | BUGFIX | WebView flash branco | background-color:white → bg_hex do tema | ui/panel_detail.py
F6.2d | BUGFIX | Labels pretos na toolbar | FG não aplicado na construção | ui/components/analysis_toolbar.py
```

## Sugestão de Commit

```
CORREÇÃO DE INICIALIZAÇÃO DARK MODE E CONTRASTE DE LEGENDAS — FASE 6.2D
```