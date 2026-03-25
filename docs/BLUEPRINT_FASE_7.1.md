# `BLUEPRINT_FASE_7.1.md`


# 🔧 BLUEPRINT — FASE 7.1: Quick Wins (Correções Visuais Isoladas)

> **Objetivo:** Implementar 6 correções de UX independentes entre si, cada uma em arquivo distinto, com validação visual imediata.
> **Estimativa:** ~1–2 dias
> **Risco geral:** 🟢 Baixo
> **Estratégia:** Implementar item por item, testar visualmente após cada um, commit individual.

---

## 📋 Checklist de Implementação

- [ ] 7.1.1 — Correção de tema na aba 3
- [ ] 7.1.2 — Expansão de thumbnail
- [ ] 7.1.3 — Ícone de configurações na toolbar
- [ ] 7.1.4 — Botões expandir/recolher na sidebar
- [ ] 7.1.5 — CTA visual para resumos vazios
- [ ] 7.1.6 — Remoção da coluna status na aba 2

---

## 7.1.1 — Correção de Tema na Aba de Detalhes

### Contexto
O `DetailPanel` (`ui/panels/panel_detail.py`) é o componente da aba 3 que exibe detalhes e transcrição de um vídeo selecionado. Ele usa um `wx.html2.WebView` para renderizar HTML estilizado com as cores do tema.

### Problema Atual
O método `apply_theme()` existe e é chamado via PubSub `THEME_CHANGED`, mas ele apenas atualiza as cores do painel wx (background, foreground). O WebView continua com o HTML antigo, renderizado com as cores do tema anterior.

### Código Atual Relevante
```python
# panel_detail.py — apply_theme() atual
def apply_theme(self):
    colors = ThemeManager.get_colors()
    self.SetBackgroundColour(wx.Colour(colors["bg_primary"]))
    # ... atualiza componentes wx
    # MAS NÃO TOCA NO WEBVIEW
```

### Solução Proposta

**Arquivo:** `ui/panels/panel_detail.py`

**Alterações:**

1. Garantir que o painel armazena o `video_id` do vídeo atualmente exibido.

2. No `apply_theme()`, após atualizar as cores wx, verificar se existe um vídeo carregado e recarregar o HTML do WebView:

```python
def apply_theme(self):
    """Aplica o tema atual a todos os componentes do painel."""
    colors = ThemeManager.get_colors()

    # 1. Atualizar cores dos componentes wx (código existente)
    self.SetBackgroundColour(wx.Colour(colors["bg_primary"]))
    # ... restante do código existente ...

    # 2. NOVO: Recarregar o WebView com o tema atualizado
    if hasattr(self, '_current_video_id') and self._current_video_id:
        self._reload_webview_content()

    self.Refresh()
    self.Update()

def _reload_webview_content(self):
    """Recarrega o conteúdo HTML do WebView com as cores do tema atual."""
    # Usa o mesmo fluxo que seria chamado ao selecionar um vídeo,
    # mas reutiliza o video_id já armazenado
    if self._current_video_id:
        self._load_video_detail(self._current_video_id)
```

3. No método que carrega um vídeo (chamado ao selecionar na grid), armazenar o ID:

```python
def _load_video_detail(self, video_id):
    """Carrega os detalhes de um vídeo no painel."""
    self._current_video_id = video_id  # NOVO: persistir para reuso
    # ... restante do código existente de carregamento ...
```

### Critérios de Validação
- [ ] Trocar tema claro → escuro com um vídeo aberto na aba 3: o HTML deve atualizar imediatamente
- [ ] Trocar tema escuro → claro: idem
- [ ] Trocar tema sem vídeo selecionado: não deve dar erro
- [ ] Selecionar novo vídeo após trocar tema: deve funcionar normalmente

### Riscos
- **Nenhum identificado.** O método de reload já existe e é chamado ao selecionar vídeos. Estamos apenas chamando-o em mais um cenário.

---

## 7.1.2 — Expansão de Thumbnail ao Clicar

### Contexto
Na aba 3, a thumbnail do vídeo é exibida como um `wx.StaticBitmap` pequeno. O usuário pode querer ver a imagem em tamanho maior para identificar o conteúdo.

### Código Atual Relevante
```python
# panel_detail.py — criação da thumbnail
self.img_thumb = wx.StaticBitmap(self, wx.ID_ANY)
```

### Solução Proposta

**Arquivo:** `ui/panels/panel_detail.py`

**Alterações:**

1. No `__init__`, adicionar bind de clique na thumbnail:

```python
self.img_thumb = wx.StaticBitmap(self, wx.ID_ANY)
self.img_thumb.Bind(wx.EVT_LEFT_UP, self._on_thumbnail_click)
self.img_thumb.SetCursor(wx.Cursor(wx.CURSOR_HAND))  # Mãozinha
```

2. Implementar o dialog de visualização:

```python
def _on_thumbnail_click(self, event):
    """Abre a thumbnail em tamanho ampliado em um dialog modal."""
    if not hasattr(self, '_current_thumbnail_path') or not self._current_thumbnail_path:
        return

    # Carregar imagem original (não a versão reduzida do StaticBitmap)
    img = wx.Image(self._current_thumbnail_path, wx.BITMAP_TYPE_ANY)
    if not img.IsOk():
        return

    # Calcular tamanho que cabe na tela (max 80% do display)
    display_w, display_h = wx.GetDisplaySize()
    max_w = int(display_w * 0.8)
    max_h = int(display_h * 0.8)

    img_w, img_h = img.GetWidth(), img.GetHeight()
    scale = min(max_w / img_w, max_h / img_h, 1.0)  # Não ampliar além do original
    new_w = int(img_w * scale)
    new_h = int(img_h * scale)

    img = img.Scale(new_w, new_h, wx.IMAGE_QUALITY_HIGH)

    # Criar dialog
    dlg = wx.Dialog(self, title="Thumbnail", style=wx.DEFAULT_DIALOG_STYLE | wx.RESIZE_BORDER)
    dlg.SetBackgroundColour(wx.Colour(0, 0, 0))

    bmp = wx.StaticBitmap(dlg, wx.ID_ANY, wx.Bitmap(img))
    sizer = wx.BoxSizer(wx.VERTICAL)
    sizer.Add(bmp, 1, wx.ALL | wx.CENTER, 10)
    dlg.SetSizer(sizer)
    dlg.Fit()
    dlg.CenterOnParent()

    # Fechar ao clicar na imagem ou pressionar ESC
    bmp.Bind(wx.EVT_LEFT_UP, lambda e: dlg.Close())
    dlg.Bind(wx.EVT_CHAR_HOOK, lambda e: dlg.Close() if e.GetKeyCode() == wx.WXK_ESCAPE else e.Skip())

    dlg.ShowModal()
    dlg.Destroy()
```

3. No método de carregamento do vídeo, armazenar o path da thumbnail:

```python
def _load_video_detail(self, video_id):
    self._current_video_id = video_id
    # ... ao carregar a thumbnail ...
    self._current_thumbnail_path = thumbnail_path  # NOVO
```

### Critérios de Validação
- [ ] Clicar na thumbnail: abre dialog com imagem ampliada
- [ ] Cursor muda para mãozinha ao passar sobre a thumbnail
- [ ] Clicar na imagem ampliada: fecha o dialog
- [ ] Pressionar ESC: fecha o dialog
- [ ] Sem vídeo selecionado: clique não faz nada (sem erro)
- [ ] Imagem maior que a tela: é reduzida para caber em 80% do display

### Riscos
- **Nenhum identificado.** Adição de funcionalidade sem alterar fluxo existente.

---

## 7.1.3 — Ícone de Configurações na Toolbar

### Contexto
A `app_window.py` contém a toolbar principal com o toggle de tema (sol/lua). O `ConfigDialog` já existe em `ui/dialogs/dialog_config.py` e funciona quando aberto via menu.

### Código Atual Relevante
```python
# app_window.py — toolbar (referência da seção de criação de toolbar)
# Atualmente possui botão de tema (toggle dark/light)
```

### Solução Proposta

**Arquivo:** `ui/app_window.py`

**Alterações:**

1. Na criação da toolbar/header, adicionar botão de configurações ao lado do botão de tema:

```python
# Criar botão de configurações
self.btn_settings = wx.BitmapButton(
    header_panel, wx.ID_ANY,
    wx.ArtProvider.GetBitmap(wx.ART_EXECUTABLE_FILE, wx.ART_TOOLBAR, (20, 20)),
    style=wx.BORDER_NONE
)
self.btn_settings.SetToolTip("Configurações")
self.btn_settings.SetCursor(wx.Cursor(wx.CURSOR_HAND))
self.btn_settings.Bind(wx.EVT_BUTTON, self._on_settings_click)

# Adicionar ao sizer da toolbar, ao lado do botão de tema
header_sizer.Add(self.btn_settings, 0, wx.ALL | wx.ALIGN_CENTER_VERTICAL, 4)
```

2. Implementar o handler:

```python
def _on_settings_click(self, event):
    """Abre o diálogo de configurações."""
    from ui.dialogs.dialog_config import ConfigDialog
    dlg = ConfigDialog(self)
    if dlg.ShowModal() == wx.ID_OK:
        # Aplicar mudanças se necessário
        self._apply_settings_changes()
    dlg.Destroy()
```

3. Atualizar o `apply_theme()` para incluir o novo botão:

```python
def apply_theme(self):
    # ... código existente ...
    self.btn_settings.SetBackgroundColour(wx.Colour(colors["bg_primary"]))
```

### Alternativa para Ícone
Se `wx.ART_EXECUTABLE_FILE` não ficar visualmente bom, usar um ícone SVG/PNG de engrenagem embutido ou criar via `wx.Bitmap` desenhado:

```python
# Alternativa: ícone de texto Unicode (mais simples)
self.btn_settings = wx.Button(header_panel, wx.ID_ANY, "⚙", style=wx.BORDER_NONE)
self.btn_settings.SetFont(wx.Font(16, wx.FONTFAMILY_DEFAULT, wx.FONTSTYLE_NORMAL, wx.FONTWEIGHT_NORMAL))
```

### Critérios de Validação
- [ ] Botão visível na toolbar ao lado do toggle de tema
- [ ] Cursor mãozinha ao hover
- [ ] Clique abre o ConfigDialog
- [ ] Tooltip "Configurações" aparece ao hover
- [ ] Botão se adapta ao tema claro/escuro
- [ ] Dialog funciona normalmente (salvar, cancelar)

### Riscos
- **Baixo.** Único risco é o posicionamento visual — pode precisar de ajuste de margens dependendo do layout atual da toolbar.

---

## 7.1.4 — Botões Expandir/Recolher na Sidebar

### Contexto
A sidebar (`ui/sidebar.py`) contém um `wx.TreeCtrl` que exibe o histórico organizado por playlists/canais. Em bibliotecas grandes, navegar pela árvore é tedioso sem controles de expansão em massa.

### Código Atual Relevante
```python
# sidebar.py — TreeCtrl
self.tree = wx.TreeCtrl(self, style=wx.TR_DEFAULT_STYLE | wx.TR_HIDE_ROOT)
```

### Solução Proposta

**Arquivo:** `ui/sidebar.py`

**Alterações:**

1. Criar um painel de botões acima da árvore:

```python
def _create_tree_controls(self):
    """Cria botões de controle acima da árvore de histórico."""
    ctrl_panel = wx.Panel(self)
    ctrl_sizer = wx.BoxSizer(wx.HORIZONTAL)

    self.btn_expand_all = wx.Button(ctrl_panel, wx.ID_ANY, "▼ Expandir", style=wx.BORDER_NONE)
    self.btn_collapse_all = wx.Button(ctrl_panel, wx.ID_ANY, "▶ Recolher", style=wx.BORDER_NONE)

    self.btn_expand_all.SetCursor(wx.Cursor(wx.CURSOR_HAND))
    self.btn_collapse_all.SetCursor(wx.Cursor(wx.CURSOR_HAND))

    # Estilo compacto
    font = wx.Font(9, wx.FONTFAMILY_DEFAULT, wx.FONTSTYLE_NORMAL, wx.FONTWEIGHT_NORMAL)
    self.btn_expand_all.SetFont(font)
    self.btn_collapse_all.SetFont(font)

    ctrl_sizer.Add(self.btn_expand_all, 0, wx.RIGHT, 4)
    ctrl_sizer.Add(self.btn_collapse_all, 0)

    ctrl_panel.SetSizer(ctrl_sizer)

    # Binds
    self.btn_expand_all.Bind(wx.EVT_BUTTON, self._on_expand_all)
    self.btn_collapse_all.Bind(wx.EVT_BUTTON, self._on_collapse_all)

    return ctrl_panel
```

2. Implementar os handlers:

```python
def _on_expand_all(self, event):
    """Expande todos os nós da árvore."""
    self.tree.ExpandAll()

def _on_collapse_all(self, event):
    """Recolhe todos os nós da árvore."""
    self.tree.CollapseAll()
    # Manter o root visível se necessário
    root = self.tree.GetRootItem()
    if root.IsOk():
        self.tree.Expand(root)
```

3. No layout da sidebar, inserir o painel de controles acima da árvore:

```python
# No __init__ ou método de layout da sidebar
main_sizer = wx.BoxSizer(wx.VERTICAL)

tree_controls = self._create_tree_controls()
main_sizer.Add(tree_controls, 0, wx.EXPAND | wx.ALL, 4)
main_sizer.Add(self.tree, 1, wx.EXPAND)

self.SetSizer(main_sizer)
```

4. Atualizar `apply_theme()` para incluir os novos botões:

```python
def apply_theme(self):
    colors = ThemeManager.get_colors()
    # ... código existente ...

    # NOVO: atualizar botões de controle
    for btn in [self.btn_expand_all, self.btn_collapse_all]:
        btn.SetBackgroundColour(wx.Colour(colors["bg_secondary"]))
        btn.SetForegroundColour(wx.Colour(colors["text_primary"]))
```

### Critérios de Validação
- [ ] Botões visíveis acima da árvore na sidebar
- [ ] "Expandir" expande todos os nós da árvore
- [ ] "Recolher" colapsa todos os nós
- [ ] Botões se adaptam ao tema claro/escuro
- [ ] Cursor mãozinha ao hover
- [ ] Com árvore vazia: botões não causam erro

### Riscos
- **Nenhum.** `ExpandAll()` e `CollapseAll()` são métodos nativos do `wx.TreeCtrl`.

---

## 7.1.5 — CTA Visual para Resumos Vazios

### Contexto
Na grid da aba 2 (análise), quando um vídeo não tem resumo, a coluna de resumo exibe um traço "—". Isso não comunica que a ação de resumir está disponível.

### Código Atual Relevante
```python
# virtual_table.py — GetValue ou renderer da coluna de resumo
# Retorna "—" quando summary é None ou vazio
```

### Solução Proposta

**Arquivo:** `ui/components/virtual_table.py`

**Alterações:**

1. No `GetValue` ou no renderer da coluna de resumo, trocar o placeholder:

```python
def GetValue(self, row, col):
    # ... lógica existente ...
    if col == SUMMARY_COL:
        summary = video_data.get('summary', '')
        if not summary or summary.strip() == '' or summary == '—':
            return "✦ Resumir"
        return summary
```

2. No renderer personalizado (se existir), alterar a cor do texto para o CTA:

```python
class SummaryRenderer(wx.grid.GridCellRenderer):
    def Draw(self, grid, attr, dc, rect, row, col, isSelected):
        # ... código existente ...
        value = grid.GetTable().GetValue(row, col)

        if value == "✦ Resumir":
            # CTA em cor de destaque
            colors = ThemeManager.get_colors()
            dc.SetTextForeground(wx.Colour(colors.get("accent", "#4A9EFF")))
            font = dc.GetFont()
            font.SetWeight(wx.FONTWEIGHT_BOLD)
            dc.SetFont(font)
        else:
            # Texto normal do resumo
            dc.SetTextForeground(wx.Colour(colors["text_primary"]))

        dc.DrawText(value, rect.x + 4, rect.y + 2)
```

3. Se não houver renderer personalizado para essa coluna, criar o override no `GetAttr`:

```python
def GetAttr(self, row, col, kind):
    attr = wx.grid.GridCellAttr()
    # ... lógica existente ...

    if col == SUMMARY_COL:
        value = self.GetValue(row, col)
        if value == "✦ Resumir":
            colors = ThemeManager.get_colors()
            attr.SetTextColour(wx.Colour(colors.get("accent", "#4A9EFF")))
            font = wx.Font(10, wx.FONTFAMILY_DEFAULT, wx.FONTSTYLE_NORMAL, wx.FONTWEIGHT_BOLD)
            attr.SetFont(font)

    return attr
```

### Critérios de Validação
- [ ] Vídeo sem resumo: exibe "✦ Resumir" em azul/destaque
- [ ] Vídeo com resumo: exibe o texto normalmente
- [ ] A cor do CTA se adapta ao tema (claro/escuro)
- [ ] O CTA aparece em negrito
- [ ] Ao reprocessar e gerar resumo: o CTA é substituído pelo texto real

### Riscos
- **Nenhum.** Alteração puramente visual no renderer/table.

---

## 7.1.6 — Remoção da Coluna Status na Aba de Análise

### Contexto
A aba de análise (aba 2) exibe uma grid com colunas incluindo "Status". Como todos os vídeos nessa aba já passaram pelo processamento, o status é sempre "completed", tornando a coluna redundante.

### Código Atual Relevante
```python
# tab_analysis.py — definição das colunas
# A grid inclui uma coluna "Status" que sempre mostra o mesmo valor
```

### Solução Proposta

**Arquivo:** `ui/tabs/tab_analysis.py`

**Alterações:**

1. Remover a coluna "Status" da definição de colunas:

```python
# ANTES:
COLUMNS = ["Preview", "Título", "Tags", "Status", "Resumo", "Link"]

# DEPOIS:
COLUMNS = ["Preview", "Título", "Tags", "Resumo", "Link"]
```

2. **⚠️ IMPORTANTE:** Verificar e atualizar TODOS os índices de coluna no código:

```python
# Buscar todas as referências a índices de coluna no tab_analysis.py
# e nos handlers de evento que referenciam colunas por número

# ANTES (exemplo):
STATUS_COL = 3
SUMMARY_COL = 4
LINK_COL = 5

# DEPOIS:
SUMMARY_COL = 3
LINK_COL = 4
```

3. Redistribuir o espaço liberado para outras colunas (ex: Resumo):

```python
# Ajustar larguras das colunas
def _setup_column_widths(self):
    # ... O espaço que era do Status vai para Resumo
    self.grid.SetColSize(SUMMARY_COL, previous_width + status_width)
```

4. Considerar adicionar "Duração" ou "Canal" no espaço liberado (decisão de UX):

```python
# Opção: substituir Status por Duração
COLUMNS = ["Preview", "Título", "Tags", "Duração", "Resumo", "Link"]
```

### Critérios de Validação
- [ ] Coluna "Status" não aparece mais na aba de análise
- [ ] Nenhuma referência por índice quebrada (clicar em todas as colunas para testar)
- [ ] Espaço redistribuído corretamente
- [ ] Seleção de linhas continua funcionando
- [ ] Menu de contexto (botão direito) continua funcionando
- [ ] Preview da thumbnail continua funcionando na posição correta

### Riscos
- **Baixo, mas requer atenção.** O risco principal é referência por índice numérico em vez de nome. Fazer busca global por `COL_STATUS` ou índice numérico da coluna removida em:
  - `tab_analysis.py`
  - `virtual_table.py` (se compartilhado)
  - Handlers de evento PubSub relacionados

---

## 🔄 Ordem de Implementação Sugerida

```
1. 7.1.1 (Tema)        → Teste visual rápido, valida o fluxo
2. 7.1.5 (CTA Resumir) → Alteração no renderer, prepara para 7.1.6
3. 7.1.6 (Rm Status)   → Refatora índices de coluna (fazer junto com 7.1.5)
4. 7.1.4 (Sidebar)     → Componente isolado
5. 7.1.3 (Settings)    → Depende de entender o layout da toolbar
6. 7.1.2 (Thumbnail)   → Mais complexo, melhor fazer por último
```

**Justificativa:** 7.1.5 e 7.1.6 mexem no mesmo arquivo (colunas da grid), então fazer em sequência evita conflitos. A thumbnail é o mais complexo (dialog modal, cálculo de escala) e fica por último.

---

## 📂 Arquivos Impactados (Resumo)

| Item | Arquivo Principal | Arquivos Secundários |
|------|-------------------|----------------------|
| 7.1.1 | `ui/panels/panel_detail.py` | — |
| 7.1.2 | `ui/panels/panel_detail.py` | — |
| 7.1.3 | `ui/app_window.py` | `ui/dialogs/dialog_config.py` |
| 7.1.4 | `ui/sidebar.py` | — |
| 7.1.5 | `ui/components/virtual_table.py` | — |
| 7.1.6 | `ui/tabs/tab_analysis.py` | `ui/components/virtual_table.py` |