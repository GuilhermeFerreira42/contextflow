# contextflow/ui/virtual_table.py
import wx
import wx.grid
import os
from services.utils import format_duration
from core.app_state import AppState

class ImageRenderer(wx.grid.GridCellRenderer):
    """Renderer customizado para exibir miniaturas (Thumbnails)."""
    def Draw(self, grid, attr, dc, rect, row, col, isSelected):
        dc.SetBackgroundMode(wx.TRANSPARENT)
        dc.SetBrush(wx.Brush(grid.GetDefaultCellBackgroundColour()))
        dc.SetPen(wx.TRANSPARENT_PEN)
        dc.DrawRectangle(rect)
        
        table = grid.GetTable()
        if row < len(table.data):
            img_path = table.data[row].get('thumbnail_path')
            if img_path and os.path.exists(img_path):
                try:
                    bmp = wx.Bitmap(img_path, wx.BITMAP_TYPE_ANY)
                    img = bmp.ConvertToImage()
                    # Rescale to fit cell
                    img = img.Rescale(rect.width-2, rect.height-2, wx.IMAGE_QUALITY_HIGH)
                    bmp = wx.Bitmap(img)
                    dc.DrawBitmap(bmp, rect.x + 1, rect.y + 1)
                    return
                except: pass
        
        # Placeholder
        dc.SetBrush(wx.Brush(wx.Colour(50, 50, 50)))
        dc.DrawRectangle(rect.x + 2, rect.y + 2, rect.width - 4, rect.height - 4)

    def GetBestSize(self, grid, attr, dc, row, col): return wx.Size(40, 40)
    def Clone(self): return ImageRenderer()

class VirtualVideoTable(wx.grid.GridTableBase):
    """
    MOTOR DE VIRTUALIZAÇÃO (SSoT)
    Implementa o padrão Sempre-Virtual para suportar 10.000+ itens.
    Regra: Renderização de célula < 0.1ms [3].
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
            # [SSOT] Ordem das 11 colunas mandatória conforme PRD Fase 5.8
            self.col_labels = [
                " # ", " [x] ", "Link", "Título", "Canal", 
                "Publicado", "Adicionado", "Playlist", "Duração", 
                "Tokens", "Status"
            ]

    def UpdateData(self, new_data):
        """
        ATOMIC SNAPSHOT: Atualiza os dados minimizando o jitter visual.
        [MANDATÓRIO v5.8] Se a contagem de linhas for igual, evita notificações
        de deletar/adicionar para impedir o 'pulo' visual na promoção de UUID para ID.
        """
        if self.GetView():
            self.GetView().BeginBatch()
            old_rows = self.GetNumberRows()
            new_rows = len(new_data)
            
            self.data = new_data
            
            # Só notifica mudança estrutural se o tamanho da lista mudar de fato
            if new_rows < old_rows:
                msg = wx.grid.GridTableMessage(self, wx.grid.GRIDTABLE_NOTIFY_ROWS_DELETED, 0, old_rows - new_rows)
                self.GetView().ProcessTableMessage(msg)
            elif new_rows > old_rows:
                msg = wx.grid.GridTableMessage(self, wx.grid.GRIDTABLE_NOTIFY_ROWS_APPENDED, new_rows - old_rows)
                self.GetView().ProcessTableMessage(msg)
            
            self.GetView().EndBatch()
            self.GetView().ForceRefresh() # Atualiza conteúdo das células sem 'pular' scroll
        else:
            self.data = new_data

    def GetNumberRows(self): return len(self.data)
    def GetNumberCols(self): return len(self.col_labels)
    def GetColLabelValue(self, col): return self.col_labels[col]

    def GetValue(self, row, col):
        """
        [IDENTIFICAÇÃO HÍBRIDA]
        Garante que a visualização trate UUID e ID como a mesma entidade durante a promoção.
        """
        try:
            if row >= len(self.data): return ""
            item = self.data[row]
            label = self.col_labels[col].strip()
            
            if label == "#": return str(row + 1)
            if label == "[x]":
                # Busca por qualquer um dos dois identificadores para manter a marcação
                # durante a transição UUID -> ID real.
                vid = item.get('id')
                uuid_val = item.get('uuid')
                selected = (vid in self.selected_ids) or (uuid_val in self.selected_ids)
                return "1" if selected else "0"
            if label == "Thumb": return "" 
            
            mapping = {
                'Link': 'url',
                'Título': 'title',
                'Canal': 'channel_name',
                'Publicado': 'upload_date',
                'Adicionado': 'added_at',
                'Playlist': 'playlist_title',
                'Tokens': 'token_count',
                'Status': 'status'
            }
            
            if label in mapping:
                val = item.get(mapping[label])
                if label == 'Status': return str(val or "pending").upper()
                if label == 'Link': return str(val or "")
                return str(val or "-")
            
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
            # [ESTABILIDADE] Prefere ID real para a chave de seleção
            vid = item.get('id') or item.get('uuid')
            if value in ["1", "True", 1, True]:
                if vid: self.selected_ids.add(vid)
            else:
                self.selected_ids.discard(vid)

    def GetAttr(self, row, col, kind):
        attr = wx.grid.GridCellAttr()
        label = self.col_labels[col].strip()
        
        if label == "[x]":
            attr.SetRenderer(wx.grid.GridCellBoolRenderer())
            attr.SetEditor(wx.grid.GridCellBoolEditor())
            attr.SetReadOnly(False)
        elif label == "Thumb":
            attr.SetRenderer(ImageRenderer())
            attr.SetReadOnly(True)
        else:
            attr.SetReadOnly(True)
        
        if label == 'Status' and row < len(self.data):
            status = str(self.data[row].get('status', '')).upper()
            color_map = {
                'ERROR': wx.RED,
                'COMPLETED': wx.Colour(0, 150, 0),
                'SUCCESS': wx.Colour(0, 150, 0),
                'DOWNLOADED': wx.Colour(0, 150, 0),
                'DOWNLOADING': wx.BLUE,
                'PROCESSING': wx.BLUE
            }
            if status in color_map:
                attr.SetTextColour(color_map[status])
        
        if label == 'Link':
            # [AFFORDANCE] Estética de hiperlink tecnológica (HeidiSQL Style)
            attr.SetTextColour(wx.BLUE)
            attr.SetFont(wx.Font(9, wx.FONTFAMILY_DEFAULT, wx.FONTSTYLE_NORMAL, wx.FONTWEIGHT_NORMAL, True)) # Underline
        
        attr.IncRef()
        return attr
