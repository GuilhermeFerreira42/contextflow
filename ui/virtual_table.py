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
        gc = wx.GraphicsContext.Create(dc)
        if gc:
            # [REGRA 5.9] Clipping obrigatório para evitar overlap
            gc.Clip(rect.x, rect.y, rect.width, rect.height)
            
            # Caminho arredondado (Rounded Clipping)
            path = gc.CreatePath()
            path.AddRoundedRectangle(rect.x + 4, rect.y + 4, 80, 45, 4)
            gc.Clip(path)
            gc.DrawBitmap(bmp, rect.x + 4, rect.y + 4, 80, 45)

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
        channel = item.get('channel_name', '-')
        
        # Cores baseadas na seleção
        txt_color = COLOR_FG if not isSelected else wx.WHITE
        sub_color = wx.Colour(140, 140, 140) if not isSelected else wx.Colour(220, 220, 220)
        
        # Limpa fundo
        bg_color = grid.GetDefaultCellBackgroundColour() if not isSelected else grid.GetSelectionBackground()
        dc.SetBrush(wx.Brush(bg_color))
        dc.SetPen(wx.TRANSPARENT_PEN)
        dc.DrawRectangle(rect)

        # [REGRA 5.9] Clipping manual no DC para evitar overlap em colunas estreitas
        dc.SetClippingRegion(rect)
        
        # Renderiza Título (Negrito)
        dc.SetFont(wx.Font(9, wx.FONTFAMILY_DEFAULT, wx.FONTSTYLE_NORMAL, wx.FONTWEIGHT_BOLD))
        dc.SetTextForeground(txt_color)
        dc.DrawText(title, rect.x + 5, rect.y + 5)
        
        # Renderiza Canal (Itálico/Menor)
        dc.SetFont(wx.Font(8, wx.FONTFAMILY_DEFAULT, wx.FONTSTYLE_ITALIC, wx.FONTWEIGHT_NORMAL))
        dc.SetTextForeground(sub_color)
        dc.DrawText(channel, rect.x + 5, rect.y + 22)
        
        dc.DestroyClippingRegion()

    def GetBestSize(self, grid, attr, dc, row, col): return wx.Size(200, 45)
    def Clone(self): return RichTitleRenderer()

class ChipTagRenderer(wx.grid.GridCellRenderer):
    """Exibe tags como pílulas coloridas (Chips) via GraphicsContext."""
    def Draw(self, grid, attr, dc, rect, row, col, isSelected):
        # Limpa fundo
        bg_color = grid.GetDefaultCellBackgroundColour() if not isSelected else grid.GetSelectionBackground()
        dc.SetBrush(wx.Brush(bg_color))
        dc.SetPen(wx.TRANSPARENT_PEN)
        dc.DrawRectangle(rect)

        table = grid.GetTable()
        if row >= len(table.data): return
        
        tags = table.data[row].get('tags', [])
        if not tags: 
            # Placeholder se não houver tags
            dc.SetTextForeground(wx.Colour(80, 80, 80))
            dc.DrawText("-", rect.x + 5, rect.y + (rect.height//2 - 7))
            return

        gc = wx.GraphicsContext.Create(dc)
        if gc:
            # [REGRA 5.9] Clipping obrigatório
            gc.Clip(rect.x, rect.y, rect.width, rect.height)
            
            x_offset = rect.x + 5
            y_pos = rect.y + (rect.height // 2 - 10)
            
            gc.SetFont(wx.Font(8, wx.FONTFAMILY_DEFAULT, wx.FONTSTYLE_NORMAL, wx.FONTWEIGHT_NORMAL), wx.BLACK)
            
            for tag in tags[:2]: # No máximo 2 tags na grade para manter limpeza
                txt_w, txt_h = dc.GetTextExtent(tag)
                chip_w = txt_w + 12
                
                # Desenha Pílula (Light Mode contrast: cinza claro com borda)
                gc.SetBrush(wx.Brush(wx.Colour(230, 230, 230, 200)))
                gc.SetPen(wx.Pen(wx.Colour(180, 180, 180), 1))
                gc.DrawRoundedRectangle(x_offset, y_pos, chip_w, 20, 10)
                
                # Texto do Chip
                gc.DrawText(tag, x_offset + 6, y_pos + 4)
                x_offset += chip_w + 4
            
            if len(tags) > 2:
                gc.DrawText(f"+{len(tags)-2}", x_offset, y_pos + 4)

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
        
        color = wx.Colour(100, 100, 100)
        if status in ['COMPLETED', 'SUCCESS', 'DONE']: color = wx.Colour(40, 167, 69)
        elif status == 'ERROR': color = wx.Colour(220, 53, 69)
        elif status in ['PROCESSING', 'DOWNLOADING']: color = COLOR_ACCENT
        
        dc.SetBrush(wx.Brush(color))
        dc.SetPen(wx.Pen(wx.WHITE, 1))
        
        center_x = rect.x + rect.width // 2
        center_y = rect.y + rect.height // 2
        dc.DrawCircle(center_x, center_y, 5)
        
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

        dc.SetTextForeground(COLOR_ACCENT)
        dc.SetFont(wx.Font(10, wx.FONTFAMILY_DEFAULT, wx.FONTSTYLE_NORMAL, wx.FONTWEIGHT_BOLD))
        
        # [ALINHAMENTO CENTRAL ABSOLUTO]
        txt = "🔗" 
        tw, th = dc.GetTextExtent(txt)
        # Ajuste fino para o emoji que pode ter baseline diferente
        dc.DrawText(txt, rect.x + (rect.width - tw)//2, rect.y + (rect.height - th)//2)
        
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

    def UpdateData(self, new_data):
        if self.GetView():
            self.GetView().BeginBatch()
            old_rows = self.GetNumberRows()
            new_rows = len(new_data)
            self.data = new_data
            
            if new_rows < old_rows:
                msg = wx.grid.GridTableMessage(self, wx.grid.GRIDTABLE_NOTIFY_ROWS_DELETED, 0, old_rows - new_rows)
                self.GetView().ProcessTableMessage(msg)
            elif new_rows > old_rows:
                msg = wx.grid.GridTableMessage(self, wx.grid.GRIDTABLE_NOTIFY_ROWS_APPENDED, new_rows - old_rows)
                self.GetView().ProcessTableMessage(msg)
            
            self.GetView().EndBatch()
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
                'Resumo': 'transcript_snippet' # Placeholder do snippet para Aba 2
            }
            
            if label in mapping:
                val = item.get(mapping[label])
                if label == 'Resumo': 
                    # [USABILIDADE v5.9] CTA para o usuário se não houver resumo
                    if not val: return "✨ Clique aqui para resumir"
                    return str(val)[:100]
                return str(val or "")
            
            if label == 'Duração':
                dur = item.get('duration_seconds') or item.get('duration')
                if isinstance(dur, (int, float)): return format_duration(dur)
                return str(dur or "00:00:00")
                
            return ""
        except Exception:
            return ""

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
        
        # [SSOT v5.9] Forçar cores do Design System em todas as células
        attr.SetBackgroundColour(COLOR_BG)
        attr.SetTextColour(COLOR_FG)

        is_ana_tab = "Preview" in self.col_labels # Heurística simples para identificar Aba 2

        if label == "[x]":
            attr.SetRenderer(wx.grid.GridCellBoolRenderer())
            attr.SetEditor(wx.grid.GridCellBoolEditor())
            attr.SetReadOnly(False)
        elif label == "Preview" and is_ana_tab:
            attr.SetRenderer(ThumbnailRenderer())
            attr.SetReadOnly(True)
        elif label == "Título":
            if is_ana_tab:
                # Aba 2: Título Rico (Título + Canal)
                attr.SetRenderer(RichTitleRenderer())
            else:
                # Aba 1: Texto Simples conforme MANDATO 5.8
                attr.SetReadOnly(True)
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
            item = self.data[row] if row < len(self.data) else {}
            if not item.get('transcript_snippet'):
                attr.SetTextColour(COLOR_ACCENT) # Azul para o CTA de resumir
            attr.SetReadOnly(True)
        else:
            attr.SetReadOnly(True)
        
        attr.IncRef()
        return attr
