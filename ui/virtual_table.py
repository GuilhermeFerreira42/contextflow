# contextflow/ui/virtual_table.py
import wx
import wx.grid
import os
import threading
from typing import Dict, Optional, List
from services.utils import format_duration
from core.app_state import AppState
from core.managers.theme_manager import ThemeManager

# --- LRU CACHE DE MIDIA (Mandato 5.9) ---
class BitmapCache:
    """
    Gerencia o cache de miniaturas em RAM para evitar I/O no scroll.
    Limite estrito de 50 Bitmaps conforme [Rich Rendering 5.9].
    """
    _cache: Dict[str, wx.Bitmap] = {}
    _order: List[str] = []
    _max_size = 50
    _lock = threading.Lock()

    @classmethod
    def get(cls, path: str) -> Optional[wx.Bitmap]:
        with cls._lock:
            if path in cls._cache:
                # Move para o fim (mais recente)
                cls._order.remove(path)
                cls._order.append(path)
                return cls._cache[path]
        return None

    @classmethod
    def set(cls, path: str, bitmap: wx.Bitmap):
        with cls._lock:
            if path in cls._cache:
                cls._order.remove(path)
            elif len(cls._cache) >= cls._max_size:
                # Remove o mais antigo (LRU)
                oldest = cls._order.pop(0)
                del cls._cache[oldest]
            
            cls._cache[path] = bitmap
            cls._order.append(path)

# --- RENDERIZADORES CUSTOMIZADOS (Phase 5.9) ---

class SafeTextRenderer(wx.grid.GridCellStringRenderer):
    """Renderer de texto padrão com Clipping Region obrigatória para evitar overflow."""
    def Draw(self, grid, attr, dc, rect, row, col, isSelected):
        dc.SetClippingRegion(rect)
        super().Draw(grid, attr, dc, rect, row, col, isSelected)
        dc.DestroyClippingRegion()
    def Clone(self): return SafeTextRenderer()

class ThumbnailRenderer(wx.grid.GridCellRenderer):
    def __init__(self):
        super().__init__()
        self._loading_paths = set()

    def Draw(self, grid, attr, dc, rect, row, col, isSelected):
        theme = ThemeManager()
        bg_color = theme.get_grid_selection_bg() if isSelected else theme.get_grid_bg()
        dc.SetBrush(wx.Brush(bg_color))
        dc.SetPen(wx.Pen(bg_color))
        dc.DrawRectangle(rect)

        table = grid.GetTable()
        if row >= len(table.data): return

        if not table.config.get("ui", "dynamic_grid", True):
            dc.SetTextForeground(theme.get_grid_selection_fg() if isSelected else theme.get_muted_color())
            dc.DrawText("[IMG]", rect.x + 10, rect.y + (rect.height // 2 - 7))
            return

        item = table.data[row]
        img_path = item.get('thumbnail_path')

        if not img_path or not os.path.exists(img_path):
            self._draw_placeholder(dc, rect, theme)
            return

        bmp = BitmapCache.get(img_path)
        if bmp:
            self._draw_bitmap_rich(dc, rect, bmp)
        else:
            self._draw_placeholder(dc, rect, theme)
            if img_path not in self._loading_paths:
                self._loading_paths.add(img_path)
                threading.Thread(target=self._async_load, args=(grid, img_path, row, col)).start()

    def _draw_placeholder(self, dc, rect, theme=None):
        if theme is None:
            theme = ThemeManager()
        dc.SetBrush(wx.Brush(theme.get_highlight_color()))
        dc.SetPen(wx.Pen(theme.get_border_color(), 1))
        dc.DrawRoundedRectangle(rect.x + 4, rect.y + 4, 80, 45, 4)

    def _draw_bitmap_rich(self, dc, rect, bmp):
        dc.SetClippingRegion(rect)
        gc = wx.GraphicsContext.Create(dc)
        if gc:
            gc.Clip(rect.x + 4, rect.y + 4, 80, 45)
            gc.DrawBitmap(bmp, rect.x + 4, rect.y + 4, 80, 45)
        dc.DestroyClippingRegion()

    def _async_load(self, grid, path, row, col):
        try:
            log = wx.LogNull()
            img = wx.Image(path, wx.BITMAP_TYPE_ANY)
            if img.IsOk():
                img = img.Scale(80, 45, wx.IMAGE_QUALITY_HIGH)
                bmp = wx.Bitmap(img)
                BitmapCache.set(path, bmp)
                wx.CallAfter(grid.ForceRefresh)
        except:
            pass
        finally:
            if path in self._loading_paths:
                self._loading_paths.remove(path)

    def GetBestSize(self, grid, attr, dc, row, col): return wx.Size(90, 55)
    def Clone(self): return ThumbnailRenderer()

class RichTitleRenderer(wx.grid.GridCellRenderer):
    def Draw(self, grid, attr, dc, rect, row, col, isSelected):
        table = grid.GetTable()
        if row >= len(table.data): return

        item = table.data[row]
        title = item.get('title', '-')

        theme = ThemeManager()
        bg_color = theme.get_grid_selection_bg() if isSelected else theme.get_grid_bg()
        txt_color = theme.get_grid_selection_fg() if isSelected else theme.get_grid_fg()

        dc.SetBrush(wx.Brush(bg_color))
        dc.SetPen(wx.Pen(bg_color))
        dc.DrawRectangle(rect)
        dc.SetClippingRegion(rect)

        dc.SetFont(wx.Font(9, wx.FONTFAMILY_DEFAULT, wx.FONTSTYLE_NORMAL, wx.FONTWEIGHT_BOLD))
        dc.SetTextForeground(txt_color)

        tw, th = dc.GetTextExtent(title)
        y_pos = rect.y + (rect.height - th) // 2
        dc.DrawText(title, rect.x + 5, y_pos)

        dc.DestroyClippingRegion()

    def GetBestSize(self, grid, attr, dc, row, col): return wx.Size(200, 45)
    def Clone(self): return RichTitleRenderer()

class ChipTagRenderer(wx.grid.GridCellRenderer):
    def _get_tag_color(self, name: str):
        import hashlib, colorsys
        h = int(hashlib.md5(name.encode()).hexdigest(), 16) % 360
        theme = ThemeManager()
        if theme.is_dark():
            # Tom mais escuro para dark mode (l=0.35, s=0.5)
            r, g, b = colorsys.hls_to_rgb(h/360.0, 0.35, 0.5)
        else:
            # Tom pastel para light mode (l=0.85, s=0.45)
            r, g, b = colorsys.hls_to_rgb(h/360.0, 0.85, 0.45)
        return wx.Colour(int(r*255), int(g*255), int(b*255))

    def _contrast_text(self, bg: wx.Colour) -> wx.Colour:
        luminance = (0.299 * bg.Red() + 0.587 * bg.Green() + 0.114 * bg.Blue())
        return wx.Colour(40, 40, 40) if luminance > 140 else wx.Colour(245, 245, 245)

    def Draw(self, grid, attr, dc, rect, row, col, isSelected):
        theme = ThemeManager()
        
        # [7.3b — SOBREPOSIÇÃO ATÔMICA]
        # 1. Limpeza Total e Obrigatória (Background-First)
        bg_color = (
            theme.get_grid_selection_bg() if isSelected
            else theme.get_grid_bg()
        )
        dc.SetBrush(wx.Brush(bg_color))
        dc.SetPen(wx.Pen(bg_color))
        dc.DrawRectangle(rect)

        # 2. Proteção de Clipping para TODO o conteúdo
        dc.SetClippingRegion(rect)

        # 3. Lógica de Dados
        table = grid.GetTable()
        if row >= len(table.data):
            dc.DestroyClippingRegion()
            return

        if not table.config.get("ui", "dynamic_grid", True):
            raw_tags = table.data[row].get('tags', '[]')
            if isinstance(raw_tags, str):
                try:
                    import json
                    tags = json.loads(raw_tags)
                except (json.JSONDecodeError, TypeError):
                    tags = []
            elif isinstance(raw_tags, list):
                tags = raw_tags
            else:
                tags = []
            dc.SetTextForeground(
                theme.get_grid_selection_fg() if isSelected
                else theme.get_grid_fg()
            )
            dc.DrawText(", ".join(tags[:2]), rect.x + 5, rect.y + (rect.height // 2 - 7))
            dc.DestroyClippingRegion()
            return

        raw_tags = table.data[row].get('tags', '[]')
        tags = []
        if isinstance(raw_tags, str):
            try:
                import json
                tags = json.loads(raw_tags)
            except (json.JSONDecodeError, TypeError):
                tags = []
        elif isinstance(raw_tags, list):
            tags = raw_tags

        if not tags:
            dc.SetTextForeground(theme.get_muted_color())
            dc.DrawText("-", rect.x + 5, rect.y + (rect.height // 2 - 7))
            dc.DestroyClippingRegion()
            return

        # 4. Desenho de Chips via GraphicsContext
        gc = wx.GraphicsContext.Create(dc)
        if gc:
            gc.Clip(rect.x, rect.y, rect.width, rect.height)
            x_offset = rect.x + 5
            y_pos = rect.y + (rect.height // 2 - 10)

            for tag in tags[:2]:
                bg_chip = self._get_tag_color(tag)
                txt_color = self._contrast_text(bg_chip)
                txt_w, txt_h = dc.GetTextExtent(tag)
                chip_w = txt_w + 12

                gc.SetBrush(wx.Brush(bg_chip))
                border_color = wx.Colour(
                    max(0, bg_chip.Red() - 30),
                    max(0, bg_chip.Green() - 30),
                    max(0, bg_chip.Blue() - 30)
                )
                gc.SetPen(wx.Pen(border_color, 1))
                gc.DrawRoundedRectangle(x_offset, y_pos, chip_w, 20, 10)
                gc.SetFont(
                    wx.Font(8, wx.FONTFAMILY_DEFAULT, wx.FONTSTYLE_NORMAL,
                            wx.FONTWEIGHT_NORMAL),
                    txt_color
                )
                gc.DrawText(tag, x_offset + 6, y_pos + 4)
                x_offset += chip_w + 4

            if len(tags) > 2:
                gc.SetFont(
                    wx.Font(8, wx.FONTFAMILY_DEFAULT, wx.FONTSTYLE_NORMAL,
                            wx.FONTWEIGHT_NORMAL),
                    theme.get_grid_selection_fg() if isSelected
                    else theme.get_muted_color()
                )
                gc.DrawText(f"+{len(tags)-2}", x_offset, y_pos + 4)

        dc.DestroyClippingRegion()

    def GetBestSize(self, grid, attr, dc, row, col): return wx.Size(100, 45)
    def Clone(self): return ChipTagRenderer()

class BadgeStatusRenderer(wx.grid.GridCellRenderer):
    def Draw(self, grid, attr, dc, rect, row, col, isSelected):
        theme = ThemeManager()
        bg_color = theme.get_grid_selection_bg() if isSelected else theme.get_grid_bg()
        dc.SetBrush(wx.Brush(bg_color))
        dc.SetPen(wx.TRANSPARENT_PEN)
        dc.DrawRectangle(rect)
        dc.SetClippingRegion(rect)

        table = grid.GetTable()
        if row >= len(table.data):
            dc.DestroyClippingRegion()
            return

        status = str(table.data[row].get('status', '')).upper()

        color = theme.get_muted_color()
        if status in ['COMPLETED', 'SUCCESS', 'DONE']: color = wx.Colour(40, 167, 69)
        elif status == 'ERROR': color = wx.Colour(220, 53, 69)
        elif status in ['PROCESSING', 'DOWNLOADING', 'QUEUED']: color = theme.get_accent_color()

        dc.SetBrush(wx.Brush(color))
        dc.SetPen(wx.Pen(theme.get_grid_bg(), 1))

        circle_x = rect.x + 10
        circle_y = rect.y + rect.height // 2
        dc.DrawCircle(circle_x, circle_y, 4)

        text = table.GetValue(row, col)
        txt_color = theme.get_grid_selection_fg() if isSelected else theme.get_grid_fg()
        dc.SetTextForeground(txt_color)
        dc.SetFont(wx.Font(8, wx.FONTFAMILY_DEFAULT, wx.FONTSTYLE_NORMAL, wx.FONTWEIGHT_NORMAL))

        if "⏳" in text:
            dc.SetTextForeground(theme.get_accent_color() if not isSelected else theme.get_grid_selection_fg())

        dc.DrawText(text, circle_x + 10, rect.y + (rect.height // 2 - 7))
        dc.DestroyClippingRegion()

    def GetBestSize(self, grid, attr, dc, row, col): return wx.Size(40, 45)
    def Clone(self): return BadgeStatusRenderer()

class SummaryStatusRenderer(wx.grid.GridCellRenderer):
    """Renderiza status do resumo com CTA visual. [7.1 PENDÊNCIA 3]"""

    def Draw(self, grid, attr, dc, rect, row, col, isSelected):
        theme = ThemeManager()

        # [7.3b — SOBREPOSIÇÃO ATÔMICA]
        # 1. Limpeza Total e Obrigatória (Background-First)
        bg_color = (
            theme.get_grid_selection_bg() if isSelected
            else theme.get_grid_bg()
        )
        dc.SetBrush(wx.Brush(bg_color))
        dc.SetPen(wx.Pen(bg_color))
        dc.DrawRectangle(rect)

        # 2. Proteção de Clipping para TODO o conteúdo
        dc.SetClippingRegion(rect)

        # 3. Lógica de Dados
        table = grid.GetTable()
        if row >= len(table.data):
            dc.DestroyClippingRegion()
            return

        item = table.data[row]
        ss = item.get('summary_status', '')

        # PASSO 3: Determina ícone e cor do texto baseado no status
        if ss == 'summarizing':
            icon = "⏳"
            color = (
                theme.get_accent_color() if not isSelected
                else theme.get_grid_selection_fg()
            )
            bold = False
        elif ss == 'summary_error':
            icon = "❌"
            color = (
                wx.Colour(220, 53, 69) if not isSelected
                else theme.get_grid_selection_fg()
            )
            bold = False
        elif ss == 'summarized':
            icon = "✓"
            color = (
                wx.Colour(40, 167, 69) if not isSelected
                else theme.get_grid_selection_fg()
            )
            bold = False
        else:
            icon = "✦ Resumir"
            color = (
                theme.get_accent_color() if not isSelected
                else theme.get_grid_selection_fg()
            )
            bold = True

        # 4. Texto desenhado SOBRE o fundo já limpo e CLIIPADO
        dc.SetTextForeground(color)
        weight = wx.FONTWEIGHT_BOLD if bold else wx.FONTWEIGHT_NORMAL
        dc.SetFont(wx.Font(9, wx.FONTFAMILY_DEFAULT, wx.FONTSTYLE_NORMAL, weight))

        tw, th = dc.GetTextExtent(icon)
        x = rect.x + (rect.width - tw) // 2
        y = rect.y + (rect.height - th) // 2
        dc.DrawText(icon, x, y)
        
        dc.DestroyClippingRegion()

    def GetBestSize(self, grid, attr, dc, row, col): return wx.Size(70, 45)
    def Clone(self): return SummaryStatusRenderer()

class LinkIconRenderer(wx.grid.GridCellRenderer):
    """[7.1 PENDÊNCIA 4] Fundo de seleção corrigido."""

    def Draw(self, grid, attr, dc, rect, row, col, isSelected):
        theme = ThemeManager()

        # [7.3b — SOBREPOSIÇÃO ATÔMICA]
        # 1. Limpeza Total e Obrigatória (Background-First)
        bg_color = (
            theme.get_grid_selection_bg() if isSelected
            else theme.get_grid_bg()
        )
        dc.SetBrush(wx.Brush(bg_color))
        dc.SetPen(wx.Pen(bg_color))
        dc.DrawRectangle(rect)

        # 2. Proteção de Clipping para TODO o conteúdo
        dc.SetClippingRegion(rect)

        # 3. Ícone desenhado SOBRE o fundo já preenchido
        icon_color = (
            theme.get_accent_color() if not isSelected
            else theme.get_grid_selection_fg()
        )
        dc.SetTextForeground(icon_color)
        dc.SetFont(wx.Font(
            10, wx.FONTFAMILY_DEFAULT,
            wx.FONTSTYLE_NORMAL, wx.FONTWEIGHT_BOLD
        ))

        txt = "🔗"
        tw, th = dc.GetTextExtent(txt)
        dc.DrawText(
            txt,
            rect.x + (rect.width - tw) // 2,
            rect.y + (rect.height - th) // 2
        )
        dc.DestroyClippingRegion()

    def GetBestSize(self, grid, attr, dc, row, col): return wx.Size(40, 45)
    def Clone(self): return LinkIconRenderer()

# --- MESA DE DADOS VIRTUALIZADA ---

class VirtualVideoTable(wx.grid.GridTableBase):
    """
    MOTOR DE VIRTUALIZAÇÃO (SSoT)
    Implementa o padrão Sempre-Virtual para suportar 10.000+ itens.
    """
    def __init__(self, data=None, col_labels=None):
        super().__init__()
        self.app_state = AppState()
        from core.config_manager import ConfigManager
        self.config = ConfigManager() # [PHASE_5_12]
        self.data = data or []
        self.selected_ids = set()
        
        # Colunas customizáveis (Aba 1 vs Aba 2)
        if col_labels:
            self.col_labels = col_labels
        else:
            # Padrão Aba 1 (Doca de Carga)
            self.col_labels = [
                " # ", " [x] ", "Link", "Título", "Canal", 
                "Publicado", "Adicionado", "Playlist", "Duração", 
                "Tokens", "Status"
            ]
        
        # [ESTADO DE ORDENAÇÃO]
        self.sort_col = -1
        self.sort_ascending = True

    def UpdateData(self, new_data):
        if self.GetView():
            self.GetView().BeginBatch()
            old_rows = self.GetNumberRows()
            new_rows = len(new_data)
            self.data = new_data
            
            if new_rows < old_rows:
                # Deletamos o excedente
                num_del = old_rows - new_rows
                msg = wx.grid.GridTableMessage(self, wx.grid.GRIDTABLE_NOTIFY_ROWS_DELETED, new_rows, num_del)
                self.GetView().ProcessTableMessage(msg)
            elif new_rows > old_rows:
                # Acrescentamos novos
                num_add = new_rows - old_rows
                msg = wx.grid.GridTableMessage(self, wx.grid.GRIDTABLE_NOTIFY_ROWS_APPENDED, num_add)
                self.GetView().ProcessTableMessage(msg)
            
            self.GetView().EndBatch()
            # [QA2 REFINE] Força recalcule total da grade para evitar 'rows fantasmas'
            self.GetView().ForceRefresh()
        else:
            self.data = new_data

    def GetNumberRows(self): return len(self.data)
    def GetNumberCols(self): return len(self.col_labels)
    def GetColLabelValue(self, col): return self.col_labels[col]

    def GetValue(self, row, col):
        try:
            if row >= len(self.data): return ""
            item = self.data[row]
            label = self.col_labels[col].strip()
            
            if label == "#": return str(row + 1)
            if label == "[x]":
                vid = item.get('id')
                uuid_val = item.get('uuid')
                selected = (vid in self.selected_ids) or (uuid_val in self.selected_ids)
                return "1" if selected else "0"
            
            # Aba 2 Columns Mapping
            mapping = {
                'Link': 'url',
                'Título': 'title',
                'Canal': 'channel_name',
                'Publicado': 'upload_date',
                'Adicionado': 'added_at',
                'Playlist': 'playlist_title',
                'Tokens': 'token_count',
                'Status': 'status',
                'Duração': 'duration', # Fallback
                'Resumo': 'transcript_snippet',
                'Tags': 'tags',
                'Tags (Raw)': 'tags'
            }
            
            if label in mapping:
                val = item.get(mapping[label])
                
                # [FASE 7.1.5] CTA de resumir (Apenas na coluna de Resumo)
                if (val is None or str(val).strip() == "") and label == 'Resumo':
                    ss = item.get('summary_status', '')
                    if ss == 'summarizing':
                        return "⏳"
                    elif ss == 'summary_error':
                        return "❌"
                    elif ss == 'summarized':
                        return "✅"
                    else:
                        return "✦ Resumir"
                
                # [QA2 REFINE] Formatação de Data: YYYYMMDD -> DD/MM/AAAA
                if label == 'Publicado' and val:
                    d_str = str(val).strip()
                    if len(d_str) == 8 and d_str.isdigit():
                        return f"{d_str[6:8]}/{d_str[4:6]}/{d_str[0:4]}"
                
                # [QA4] Formatação de Milhares para Tokens
                if label == 'Tokens' and val:
                    try:
                        num = int(val)
                        return f"{num:,}".replace(",", ".")
                    except:
                        return str(val)

                # [QA2 REFINE] Feedback Dinâmico de Status
                if label == 'Status' and val:
                    status_val = str(val).upper()
                    if status_val == 'DOWNLOADING':
                        prog = item.get('progress_msg')
                        return f"⏳ {prog}" if prog else "⏳ Baixando..."
                    return status_val
                
                if (label == 'Tags' or label == 'Tags (Raw)') and val:
                    raw_tags = val
                    if isinstance(raw_tags, str):
                        try:
                            import json
                            tags = json.loads(raw_tags)
                            return ", ".join(tags)
                        except:
                            return raw_tags
                    elif isinstance(raw_tags, list):
                        return ", ".join(raw_tags)
                    return str(raw_tags)

                return str(val) if val is not None else ""
            
            if label == 'Duração':
                dur = item.get('duration_seconds') or item.get('duration')
                if dur is None or str(dur).strip() == "": return "-"
                if isinstance(dur, (int, float)): return format_duration(dur)
                return str(dur)
                
            return "-"
        except Exception:
            return "-"

    def SetValue(self, row, col, value):
        label = self.col_labels[col].strip()
        if label == "[x]" and row < len(self.data):
            item = self.data[row]
            vid = item.get('id') or item.get('uuid')
            if value in ["1", "True", 1, True]:
                if vid: self.selected_ids.add(vid)
            else:
                self.selected_ids.discard(vid)

    def GetAttr(self, row, col, kind):
        attr = wx.grid.GridCellAttr()
        label = self.col_labels[col].strip()
        theme = ThemeManager()

        # [FASE 7.3b] Persistência via GetAttr (Garantidor Final)
        if row < len(self.data):
            item = self.data[row]
            vid = item.get('id') or item.get('uuid')
            
            if vid in self.selected_ids:
                attr.SetBackgroundColour(theme.get_grid_selection_bg())
                attr.SetTextColour(theme.get_grid_selection_fg())
            else:
                attr.SetBackgroundColour(theme.get_grid_bg())
                attr.SetTextColour(theme.get_grid_fg())

        # ALINHAMENTO CENTRAL (Exceto Título)
        if label != "Título":
            attr.SetAlignment(wx.ALIGN_CENTER, wx.ALIGN_CENTER)
        else:
            attr.SetAlignment(wx.ALIGN_LEFT, wx.ALIGN_CENTER)

        # [REQUISITO ABA 2] Heurística de Identificação Analítica
        is_ana_tab = ("Preview" in self.col_labels)

        if label == "[x]":
            attr.SetRenderer(wx.grid.GridCellBoolRenderer())
            attr.SetEditor(wx.grid.GridCellBoolEditor())
            attr.SetReadOnly(False)
        elif label == "Preview" and is_ana_tab:
            attr.SetRenderer(ThumbnailRenderer())
            attr.SetReadOnly(True)
        elif label == "Título":
            if is_ana_tab:
                attr.SetRenderer(RichTitleRenderer())
            else:
                attr.SetRenderer(SafeTextRenderer())
            attr.SetReadOnly(True)
        elif label == "Tags":
            attr.SetRenderer(ChipTagRenderer())
            attr.SetReadOnly(True)
        elif label == "Link":
            attr.SetRenderer(LinkIconRenderer())
            attr.SetReadOnly(True)
        elif label == "Status":
            attr.SetRenderer(BadgeStatusRenderer())
            attr.SetReadOnly(True)
        elif label == "Resumo" and is_ana_tab:
            value = self.GetValue(row, col)
            if value == "✦ Resumir":
                attr.SetTextColour(wx.Colour(theme.get_accent_color()))
                font = attr.GetFont()
                font.SetWeight(wx.FONTWEIGHT_BOLD)
                attr.SetFont(font)
            attr.SetRenderer(SummaryStatusRenderer())
            attr.SetReadOnly(True)
        else:
            attr.SetRenderer(SafeTextRenderer())
            attr.SetReadOnly(True)
        
        attr.IncRef()
        return attr
