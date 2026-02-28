# contextflow/ui/virtual_table.py
import wx
import wx.grid
import os
import threading
from typing import Dict, Optional, List
from services.utils import format_duration
from core.app_state import AppState
from constants import COLOR_BG, COLOR_FG, COLOR_ACCENT

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
        # Força alinhamento central em todos os renderers de texto puro
        attr.SetAlignment(wx.ALIGN_CENTER, wx.ALIGN_CENTER)
        super().Draw(grid, attr, dc, rect, row, col, isSelected)
        dc.DestroyClippingRegion()
    def Clone(self): return SafeTextRenderer()

class ThumbnailRenderer(wx.grid.GridCellRenderer):
    """
    Renderizador de alta fidelidade com cantos arredondados e LRU Cache.
    Atende ao requisito de performance de 60 FPS com 10.000 itens.
    """
    def __init__(self):
        super().__init__()
        self._loading_paths = set()

    def Draw(self, grid, attr, dc, rect, row, col, isSelected):
        # Limpa o fundo
        bg_color = grid.GetDefaultCellBackgroundColour() if not isSelected else grid.GetSelectionBackground()
        dc.SetBrush(wx.Brush(bg_color))
        dc.SetPen(wx.TRANSPARENT_PEN)
        dc.DrawRectangle(rect)

        table = grid.GetTable()
        if row >= len(table.data): return
        
        # [PERFORMANCE 5.12] Grade Dinâmica: Ignora miniaturas se desativado
        if not table.config.get("ui", "dynamic_grid", True):
            dc.SetTextForeground(wx.BLACK if not isSelected else wx.WHITE)
            dc.DrawText("[IMG]", rect.x + 10, rect.y + (rect.height // 2 - 7))
            return

        item = table.data[row]
        img_path = item.get('thumbnail_path')
        
        # Placeholder se não houver path
        if not img_path or not os.path.exists(img_path):
            self._draw_placeholder(dc, rect)
            return

        bmp = BitmapCache.get(img_path)
        if bmp:
            self._draw_bitmap_rich(dc, rect, bmp)
        else:
            self._draw_placeholder(dc, rect)
            # Dispara carregamento assíncrono se não estiver em curso
            if img_path not in self._loading_paths:
                self._loading_paths.add(img_path)
                threading.Thread(target=self._async_load, args=(grid, img_path, row, col)).start()

    def _draw_placeholder(self, dc, rect):
        dc.SetBrush(wx.Brush(wx.Colour(40, 40, 40)))
        dc.SetPen(wx.Pen(wx.Colour(60, 60, 60), 1))
        # Desenha um retângulo com bordas simples para o placeholder
        dc.DrawRoundedRectangle(rect.x + 4, rect.y + 4, 80, 45, 4)

    def _draw_bitmap_rich(self, dc, rect, bmp):
        """Usa GraphicsContext para renderização com Antialiasing."""
        # [MANDATO 5.9] Clipping absoluto via DC antes do GC para estabilidade
        dc.SetClippingRegion(rect)
        gc = wx.GraphicsContext.Create(dc)
        if gc:
            # [REGRA 5.9] Clipping secundário no GC via Rect (evita crash do path.Clip)
            gc.Clip(rect.x + 4, rect.y + 4, 80, 45)
            gc.DrawBitmap(bmp, rect.x + 4, rect.y + 4, 80, 45)
        dc.DestroyClippingRegion()

    def _async_load(self, grid, path, row, col):
        """Carregamento em thread separada com redimensionamento forçado 80x45."""
        try:
            # Silencia logs do wx para evitar spam de imagem
            log = wx.LogNull()
            img = wx.Image(path, wx.BITMAP_TYPE_ANY)
            if img.IsOk():
                # [MANDATO 5.9] Redimensionamento estável 80x45
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
    """
    Renderizador Master-Detail: Título (Negrito) + Canal (Itálico abaixo).
    """
    def Draw(self, grid, attr, dc, rect, row, col, isSelected):
        table = grid.GetTable()
        if row >= len(table.data): return
        
        item = table.data[row]
        title = item.get('title', '-')
        
        # Cores baseadas na seleção
        txt_color = COLOR_FG if not isSelected else wx.WHITE
        
        # Limpa fundo
        bg_color = grid.GetDefaultCellBackgroundColour() if not isSelected else grid.GetSelectionBackground()
        dc.SetBrush(wx.Brush(bg_color))
        dc.SetPen(wx.TRANSPARENT_PEN)
        dc.DrawRectangle(rect)

        # [REQUISITO 5.9] Clipping manual e Título Puro (Sem Canal)
        dc.SetClippingRegion(rect)
        
        # Renderiza Título (Negrito)
        dc.SetFont(wx.Font(9, wx.FONTFAMILY_DEFAULT, wx.FONTSTYLE_NORMAL, wx.FONTWEIGHT_BOLD))
        dc.SetTextForeground(txt_color)
        
        # Alinhamento vertical e horizontal centralizado para o título único
        tw, th = dc.GetTextExtent(title)
        x_pos = rect.x + (rect.width - tw) // 2
        y_pos = rect.y + (rect.height - th) // 2
        dc.DrawText(title, x_pos, y_pos)
        
        dc.DestroyClippingRegion()

    def GetBestSize(self, grid, attr, dc, row, col): return wx.Size(200, 45)
    def Clone(self): return RichTitleRenderer()

class ChipTagRenderer(wx.grid.GridCellRenderer):
    """Exibe tags como pílulas coloridas (Chips) com cores dinâmicas baseadas em hash."""
    
    def _get_tag_color(self, name: str):
        """Gera uma cor pastel baseada no hash do nome da tag."""
        import hashlib
        # Gera um valor hash estável 0-359 (Hue)
        h = int(hashlib.md5(name.encode()).hexdigest(), 16) % 360
        # h, s, l: s=70%, l=90% para tons pastel suaves
        return wx.Colour().SetHSB(h/360.0, 0.4, 0.95)

    def Draw(self, grid, attr, dc, rect, row, col, isSelected):
        # Limpa fundo
        bg_color = grid.GetDefaultCellBackgroundColour() if not isSelected else grid.GetSelectionBackground()
        dc.SetBrush(wx.Brush(bg_color))
        dc.SetPen(wx.TRANSPARENT_PEN)
        dc.DrawRectangle(rect)

        table = grid.GetTable()
        if row >= len(table.data): return
        
        # [PERFORMANCE 5.12] Grade Dinâmica: Ignora chips se desativado (renderiza texto)
        if not table.config.get("ui", "dynamic_grid", True):
            tags = table.data[row].get('tags', [])
            dc.SetTextForeground(wx.BLACK if not isSelected else wx.WHITE)
            dc.DrawText(", ".join(tags[:2]), rect.x + 5, rect.y + (rect.height // 2 - 7))
            return

        tags = table.data[row].get('tags', [])
        if not tags: 
            # Placeholder se não houver tags
            dc.SetTextForeground(wx.Colour(80, 80, 80))
            dc.DrawText("-", rect.x + 5, rect.y + (rect.height//2 - 7))
            return

        gc = wx.GraphicsContext.Create(dc)
        if gc:
            # [REGRA 5.9] Clipping obrigatório utilizando DC Clipping Region antes (mais seguro)
            dc.SetClippingRegion(rect)
            gc.Clip(rect.x, rect.y, rect.width, rect.height)
            
            x_offset = rect.x + 5
            y_pos = rect.y + (rect.height // 2 - 10)
            
            gc.SetFont(wx.Font(8, wx.FONTFAMILY_DEFAULT, wx.FONTSTYLE_NORMAL, wx.FONTWEIGHT_NORMAL), wx.BLACK)
            
            for tag in tags[:2]: # No máximo 2 tags na grade para manter limpeza
                txt_w, txt_h = dc.GetTextExtent(tag)
                chip_w = txt_w + 12
                
                # [QA4] Color-Coding de Tags (Estética SaaS)
                bg_chip = self._get_tag_color(tag)
                gc.SetBrush(wx.Brush(bg_chip))
                # Borda sutilmente mais escura que o fundo
                border_color = wx.Colour(
                    max(0, bg_chip.Red() - 30),
                    max(0, bg_chip.Green() - 30),
                    max(0, bg_chip.Blue() - 30)
                )
                gc.SetPen(wx.Pen(border_color, 1))
                gc.DrawRoundedRectangle(x_offset, y_pos, chip_w, 20, 10)
                
                # Texto do Chip
                gc.DrawText(tag, x_offset + 6, y_pos + 4)
                x_offset += chip_w + 4
            
            if len(tags) > 2:
                gc.DrawText(f"+{len(tags)-2}", x_offset, y_pos + 4)
            
        dc.DestroyClippingRegion()

    def GetBestSize(self, grid, attr, dc, row, col): return wx.Size(100, 45)
    def Clone(self): return ChipTagRenderer()

class BadgeStatusRenderer(wx.grid.GridCellRenderer):
    """Círculo colorido para indicação de status (HeidiSQL/Tailwind Style)."""
    def Draw(self, grid, attr, dc, rect, row, col, isSelected):
        bg_color = grid.GetDefaultCellBackgroundColour() if not isSelected else grid.GetSelectionBackground()
        dc.SetBrush(wx.Brush(bg_color))
        dc.SetPen(wx.TRANSPARENT_PEN)
        dc.DrawRectangle(rect)

        # [REGRA 5.9] Clipping
        dc.SetClippingRegion(rect)

        table = grid.GetTable()
        if row >= len(table.data): 
            dc.DestroyClippingRegion()
            return
        
        status = str(table.data[row].get('status', '')).upper()
        text = table.GetValue(row, col)
        
        color = wx.Colour(100, 100, 100) # Gray
        bg_chip = wx.Colour(240, 240, 240)
        
        if status in ['COMPLETED', 'SUCCESS', 'DONE']: 
            color = wx.Colour(21, 128, 61) # Green 700
            bg_chip = wx.Colour(220, 252, 231) # Green 100
        elif status == 'ERROR': 
            color = wx.Colour(185, 28, 28) # Red 700
            bg_chip = wx.Colour(254, 226, 226) # Red 100
        elif status in ['PROCESSING', 'DOWNLOADING', 'QUEUED']: 
            color = wx.Colour(29, 78, 216) # Blue 700
            bg_chip = wx.Colour(219, 234, 254) # Blue 100
        
        # [ESTÉTICA CHIP]
        gc = wx.GraphicsContext.Create(dc)
        if gc:
            gc.SetBrush(wx.Brush(bg_chip))
            gc.SetPen(wx.Pen(color, 1))
            
            # Calcula largura do chip baseado no texto
            gc.SetFont(wx.Font(8, wx.FONTFAMILY_DEFAULT, wx.FONTSTYLE_NORMAL, wx.FONTWEIGHT_BOLD), color)
            tw, th = dc.GetTextExtent(text)
            chip_pad = 8
            chip_h = 18
            chip_w = tw + (chip_pad * 2)
            
            # Desenha Chip Centralizado
            cx = rect.x + 5
            cy = rect.y + (rect.height - chip_h) // 2
            gc.DrawRoundedRectangle(cx, cy, chip_w, chip_h, 9)
            
            # Desenha Texto
            gc.DrawText(text, cx + chip_pad, cy + (chip_h - th) // 2)
        
        dc.DestroyClippingRegion()

    def GetBestSize(self, grid, attr, dc, row, col): return wx.Size(40, 45)
    def Clone(self): return BadgeStatusRenderer()

class LinkIconRenderer(wx.grid.GridCellRenderer):
    """Ícone de link em vez de texto cru (Mockup v6.0)."""
    def Draw(self, grid, attr, dc, rect, row, col, isSelected):
        bg_color = grid.GetDefaultCellBackgroundColour() if not isSelected else grid.GetSelectionBackground()
        dc.SetBrush(wx.Brush(bg_color))
        dc.SetPen(wx.TRANSPARENT_PEN)
        dc.DrawRectangle(rect)

        # [REGRA 5.9] Clipping
        dc.SetClippingRegion(rect)

        # [QA2 REFINE] Se estiver selecionado, muda para branco para contraste sobre fundo azul
        icon_color = COLOR_ACCENT if not isSelected else wx.WHITE
        dc.SetTextForeground(icon_color)
        dc.SetFont(wx.Font(10, wx.FONTFAMILY_DEFAULT, wx.FONTSTYLE_NORMAL, wx.FONTWEIGHT_BOLD))
        
        # [ALINHAMENTO CENTRAL ABSOLUTO]
        txt = "🔗" 
        tw, th = dc.GetTextExtent(txt)
        # Ajuste fino para o emoji que pode ter baseline diferente
        dc.DrawText(txt, rect.x + (rect.width - tw)//2, rect.y + (rect.height - th)//2)
        
        dc.DestroyClippingRegion()

    def GetBestSize(self, grid, attr, dc, row, col): return wx.Size(40, 45)
    def Clone(self): return LinkIconRenderer()

class SummaryRenderer(wx.grid.GridCellStringRenderer):
    """Renderiza snippet de resumo ou CTA vibrante."""
    def Draw(self, grid, attr, dc, rect, row, col, isSelected):
        dc.SetClippingRegion(rect)
        table = grid.GetTable()
        item = table.data[row] if row < len(table.data) else {}
        val = table.GetValue(row, col)
        
        # Limpa fundo
        bg_color = grid.GetDefaultCellBackgroundColour() if not isSelected else grid.GetSelectionBackground()
        dc.SetBrush(wx.Brush(bg_color))
        dc.SetPen(wx.TRANSPARENT_PEN)
        dc.DrawRectangle(rect)
        
        if not item.get('summary_text'):
            # Estilo CTA
            dc.SetTextForeground(COLOR_ACCENT if not isSelected else wx.WHITE)
            dc.SetFont(wx.Font(9, wx.FONTFAMILY_DEFAULT, wx.FONTSTYLE_ITALIC, wx.FONTWEIGHT_NORMAL))
        else:
            # Estilo Snippet
            dc.SetTextForeground(COLOR_FG if not isSelected else wx.WHITE)
            dc.SetFont(wx.Font(9, wx.FONTFAMILY_DEFAULT, wx.FONTSTYLE_NORMAL, wx.FONTWEIGHT_NORMAL))
            
        # Alinhamento Centralizado
        tw, th = dc.GetTextExtent(val)
        x_pos = rect.x + (rect.width - tw) // 2
        y_pos = rect.y + (rect.height - th) // 2
        dc.DrawText(val, x_pos, y_pos)
        dc.DestroyClippingRegion()
    
    def Clone(self): return SummaryRenderer()

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
        
        # Colunas customizáveis (Aba 1 vs Aba 2)
        if col_labels:
            self.col_labels = col_labels
        else:
            # Coluna [x] é OBRIGATORIAMENTE a Coluna 0 (Mandato Fase 6)
            self.col_labels = [
                " [x] ", " # ", "Link", "Título", "Canal", 
                "Publicado", "Adicionado", "Playlist", "Duração", 
                "Tokens", "Status"
            ]
        
        # [ESTADO DE ORDENAÇÃO]
        self.sort_col = -1
        self.sort_ascending = True

    # [PHASE 6] Seleção Global (Proxy para AppState)
    @property
    def selected_ids(self):
        return self.app_state.get_selected_ids()
        
    @selected_ids.setter
    def selected_ids(self, ids):
        if ids is None:
            self.app_state.clear_selection()
        else:
            # Sincroniza o set externo com o AppState
            self.app_state.clear_selection()
            for vid in ids:
                self.app_state.set_selection(vid, True)

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
                vid = item.get('id') or item.get('uuid')
                selected = self.app_state.is_selected(vid)
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
                'Duração': 'duration',
                'Resumo': 'summary_text'
            }
            
            if label in mapping:
                val = item.get(mapping[label])
                
                # [QA2 REFINE] Estabilidade de Células: Retorna '-' se vazio
                if val is None or str(val).strip() == "":
                    if label == 'Resumo': return "✨ Clique aqui para resumir"
                    return "-"
                
                # [QA4] Formatação de Milhares para Tokens
                if label == 'Tokens':
                    try:
                        num = int(val)
                        return f"{num:,}".replace(",", ".")
                    except:
                        return str(val)

                if label == 'Resumo': 
                    # Exibe snippet do resumo se existir
                    return str(val).replace('\n', ' ')[:150]
                
                # [QA2 REFINE] Formatação de Data: YYYYMMDD -> DD/MM/AAAA
                if label == 'Publicado':
                    d_str = str(val).strip()
                    if len(d_str) == 8 and d_str.isdigit():
                        return f"{d_str[6:8]}/{d_str[4:6]}/{d_str[0:4]}"
                
                # [QA2 REFINE] Feedback Dinâmico de Status
                if label == 'Status':
                    status_val = str(val).upper()
                    if status_val == 'DOWNLOADING':
                        prog = item.get('progress_msg')
                        return f"⏳ {prog}" if prog else "⏳ Baixando..."
                    return status_val

                return str(val)
            
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
            selected = value in ["1", "True", 1, True]
            self.app_state.set_selection(vid, selected)

    def GetAttr(self, row, col, kind):
        attr = wx.grid.GridCellAttr()
        label = self.col_labels[col].strip()
        
        # [SSOT v5.9] Forçar cores do Design System em todas as células
        attr.SetBackgroundColour(COLOR_BG)
        attr.SetTextColour(COLOR_FG)
        
        # [PHASE 6.1] ALINHAMENTO CENTRAL GLOBAL
        attr.SetAlignment(wx.ALIGN_CENTER, wx.ALIGN_CENTER)

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
            attr.SetRenderer(SummaryRenderer())
            attr.SetReadOnly(True)
        else:
            attr.SetRenderer(SafeTextRenderer())
            attr.SetReadOnly(True)
        
        attr.IncRef()
        return attr
