import wx
import wx.grid
from services.utils import format_duration

class VirtualVideoTable(wx.grid.GridTableBase):
    def __init__(self, data=None):
        super().__init__()
        self.data = data or []
        self.selected_ids = set()
        
        self.col_labels = [
            " [x] ", "ID", "Link", "Título", "Canal", 
            "Publicado", "Adicionado", "Playlist", "Duração", "Tokens", "Status"
        ]

    def UpdateData(self, new_data):
        # Notify Grid about change
        # Bruteforce approach: Tells grid the table has changed size or content
        self.data = new_data
        
        if self.GetView():
            self.GetView().BeginBatch()
            
            # Reset view if possible, or inform rows
            current_rows = self.GetNumberRows()
            
            # This logic is tricky. The easiest way to refresh a Virtual Grid 
            # is normally ProcessTableMessage(RESET) or telling it rows changed.
            # But the documentation implies we should just set the data and the grid will query GetValue.
            # However, row count might change.
            
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
        try:
            if row >= len(self.data): return ""
            item = self.data[row]
            
            if col == 0: # Checkbox
                vid = item.get('id') or item.get('uuid')
                return "1" if vid in self.selected_ids else "0"
                
            elif col == 1: # ID
                return str(item.get('id') or item.get('uuid') or "...")
                
            elif col == 2: # Link
                return str(item.get('url', ''))
                
            elif col == 3: # Title
                return str(item.get('title', 'Aguardando...'))
                
            elif col == 4: # Channel
                return str(item.get('channel_name') or "-")
                
            elif col == 5: # Published
                raw = str(item.get('upload_date') or "")
                if len(raw) == 8 and raw.isdigit():
                    return f"{raw[6:8]}/{raw[4:6]}/{raw[0:4]}"
                return raw
                
            elif col == 6: # Added
                return str(item.get('added_at') or "")
                
            elif col == 7: # Playlist
                return str(item.get('playlist_title') or "-")
                
            elif col == 8: # Duration
                dur = item.get('duration_seconds') or item.get('duration')
                return format_duration(dur)
                
            elif col == 9: # Tokens
                return str(item.get('token_count', 0))
                
            elif col == 10: # Status
                return str(item.get('status', 'pending'))
        except:
            pass
        return ""

    def SetValue(self, row, col, value):
        if col == 0:
            if row >= len(self.data): return
            item = self.data[row]
            vid = item.get('id') or item.get('uuid')
            if vid:
                # Toggle logic
                # Grid passes "1" or "0" usually if checkbox
                # But sometimes it passes empty or we handle click.
                # Standard Text Editor passes string.
                # bool check
                if value in ["1", "True", "true", 1]:
                    self.selected_ids.add(vid)
                else:
                    self.selected_ids.discard(vid)

    def GetAttr(self, row, col, kind):
        attr = wx.grid.GridCellAttr()
        
        # Read-only default for all except Checkbox (col 0)
        # Actually, if we use custom renderer for checkbox, we might need read-only=False
        if col != 0:
            attr.SetReadOnly(True)
        else:
            attr.SetReadOnly(False)
            
        # Specific styling
        if col == 2: # Link
            attr.SetTextColour(wx.BLUE)
            
        elif col == 10: # Status
             if row < len(self.data):
                status = self.data[row].get('status', '')
                if status == 'ERROR':
                    attr.SetTextColour(wx.RED)
                elif status in ['completed', 'downloaded']:
                    attr.SetTextColour(wx.BLACK)
                else:
                    attr.SetTextColour(wx.Colour(200, 100, 0)) # Orange-ish

        # Align center for most
        if col not in [2, 3, 7]: # Link, Title, Playlist left aligned
            attr.SetAlignment(wx.ALIGN_CENTER, wx.ALIGN_CENTER)
            
        attr.IncRef()
        return attr
