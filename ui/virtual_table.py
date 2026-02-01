# contextflow/ui/virtual_table.py
import wx
import wx.grid
from services.utils import format_duration
from core.app_state import AppState

class VirtualVideoTable(wx.grid.GridTableBase):
    """
    MOTOR DE VIRTUALIZAÇÃO (SSoT)
    Implementa o padrão Sempre-Virtual para suportar 10.000+ itens.
    Regra: Renderização de célula < 0.1ms [3].
    """
    def __init__(self, data=None):
        super().__init__()
        self.app_state = AppState()
        self.data = data or []
        self.selected_ids = set()
        
        # Colunas oficiais conforme PRD e specs de Triagem [5]
        self.col_labels = [
            " [x] ", "ID", "Título", "Canal", 
            "Duração", "Tokens", "Status", "Link"
        ]

    def UpdateData(self, new_data):
        """
        Atualiza o snapshot de dados e notifica a Grid.
        Mantém a persistência da visualização durante o debouncing [6].
        """
        self.data = new_data
        if self.GetView():
            self.GetView().BeginBatch()
            # Notifica a Grid que o número de linhas mudou para atualizar a ScrollBar
            msg = wx.grid.GridTableMessage(self, wx.grid.GRIDTABLE_NOTIFY_ROWS_DELETED, 0, self.GetView().GetNumberRows())
            self.GetView().ProcessTableMessage(msg)
            msg = wx.grid.GridTableMessage(self, wx.grid.GRIDTABLE_NOTIFY_ROWS_APPENDED, len(self.data))
            self.GetView().ProcessTableMessage(msg)
            self.GetView().EndBatch()
            self.GetView().ForceRefresh()

    def GetNumberRows(self):
        return len(self.data)

    def GetNumberCols(self):
        return len(self.col_labels)

    def GetColLabelValue(self, col):
        return self.col_labels[col]

    def GetValue(self, row, col):
        """
        [PERFORMANCE] Método ultra-rápido para renderização sob demanda.
        Busca apenas o campo necessário do snapshot em memória [3].
        """
        try:
            if row >= len(self.data): return ""
            item = self.data[row]
            
            if col == 0: # Checkbox
                vid = item.get('id') or item.get('uuid')
                return "1" if vid in self.selected_ids else "0"
            elif col == 1: # ID
                return str(item.get('id') or item.get('uuid') or "...")
            elif col == 2: # Título
                return str(item.get('title', 'Aguardando...'))
            elif col == 3: # Canal
                return str(item.get('channel_name') or "-")
            elif col == 4: # Duração
                dur = item.get('duration_seconds') or item.get('duration')
                return format_duration(dur)
            elif col == 5: # Tokens
                return str(item.get('token_count', 0))
            elif col == 6: # Status
                return str(item.get('status', 'pending')).upper()
            elif col == 7: # Link
                return str(item.get('url', ''))
        except Exception:
            return ""

    def SetValue(self, row, col, value):
        """Gerencia a seleção de linhas (Checkbox)."""
        if col == 0 and row < len(self.data):
            item = self.data[row]
            vid = item.get('id') or item.get('uuid')
            if value in ["1", "True", 1]:
                self.selected_ids.add(vid)
            else:
                self.selected_ids.discard(vid)

    def GetAttr(self, row, col, kind):
        """Aplica telemetria visual (Cores de Status) [7]."""
        attr = wx.grid.GridCellAttr()
        attr.SetReadOnly(col != 0) # Apenas checkbox é editável
        
        if col == 6 and row < len(self.data): # Status
            status = str(self.data[row].get('status', '')).upper()
            if status == 'ERROR':
                attr.SetTextColour(wx.RED)
            elif status in ['COMPLETED', 'DOWNLOADED']:
                attr.SetTextColour(wx.Colour(0, 150, 0)) # Verde
        
        if col == 7: # Link
            attr.SetTextColour(wx.BLUE)
            
        attr.IncRef()
        return attr
