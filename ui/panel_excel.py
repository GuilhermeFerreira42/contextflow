# contextflow/ui/panel_excel.py
import wx
import wx.grid
from storage.db_handler import DatabaseHandler
from util import format_seconds
import os

class ExcelPanel(wx.Panel):
    def __init__(self, parent):
        super().__init__(parent)
        self.db_handler = DatabaseHandler()
        self.row_map_id = {}
        
        self._init_ui()
        self.refresh_data()

    def _init_ui(self):
        main_sizer = wx.BoxSizer(wx.VERTICAL)

        # Header Actions
        action_sizer = wx.BoxSizer(wx.HORIZONTAL)
        lbl = wx.StaticText(self, label="2. Tabela Excel")
        font = lbl.GetFont()
        font.SetWeight(wx.FONTWEIGHT_BOLD)
        lbl.SetFont(font)
        
        self.btn_delete = wx.Button(self, label="Excluir Selecionados")
        self.btn_delete.Bind(wx.EVT_BUTTON, self.on_delete_selected)
        
        action_sizer.Add(lbl, 0, wx.ALIGN_CENTER_VERTICAL | wx.RIGHT, 20)
        action_sizer.Add(self.btn_delete, 0, wx.ALIGN_CENTER_VERTICAL)
        
        main_sizer.Add(action_sizer, 0, wx.ALL, 10)

        # GRID
        self.grid = wx.grid.Grid(self)
        self.grid.CreateGrid(0, 7) # 7 Colunas
        
        # Colunas: [x], Thumb, Link, Título, Playlist, Tempo, Tokens
        cols = [" [x] ", "Thumb", "Link", "Título", "Playlist", "Tempo (HH:MM:SS)", "Tokens"]
        for i, c in enumerate(cols):
            self.grid.SetColLabelValue(i, c)
        
        # Configurar Tamanhos e Tipos
        self.grid.SetColFormatBool(0) 
        self.grid.SetColSize(0, 40)
        self.grid.SetColSize(1, 100) # Thumb
        self.grid.SetColSize(2, 200) # Link
        self.grid.SetColSize(3, 300) # Titulo
        self.grid.SetColSize(4, 150) # Playlist
        self.grid.SetColSize(5, 100) # Tempo
        self.grid.SetColSize(6, 80)  # Tokens
        
        self.grid.Bind(wx.grid.EVT_GRID_LABEL_LEFT_CLICK, self.on_header_click)
        
        main_sizer.Add(self.grid, 1, wx.EXPAND | wx.ALL, 5)
        self.SetSizer(main_sizer)

    def refresh_data(self):
        if self.grid.GetNumberRows() > 0:
            self.grid.DeleteRows(0, self.grid.GetNumberRows())
            
        videos = self.db_handler.get_all_videos()
        videos.sort(key=lambda x: x['created_at'], reverse=True)
        
        self.grid.AppendRows(len(videos))
        self.row_map_id = {}
        
        for i, v in enumerate(videos):
            vid = v['id']
            self.row_map_id[i] = vid
            
            # 0. Checkbox
            # FIX: WxGrid Bool Renderer expects "" (empty string) for False, "1" for True. "0" causes assertions.
            self.grid.SetCellValue(i, 0, "")
            
            # 1. Thumbnail
            self.grid.SetCellValue(i, 1, "[Imagem]") 
            self.grid.SetReadOnly(i, 1, True)
            
            # 2. Link
            self.grid.SetCellValue(i, 2, v.get('url', ''))
            self.grid.SetReadOnly(i, 2, True)
            
            # 3. Título
            self.grid.SetCellValue(i, 3, v.get('title', ''))
            self.grid.SetReadOnly(i, 3, True)
            
            # 4. Playlist
            self.grid.SetCellValue(i, 4, v.get('playlist_title') or "-")
            self.grid.SetReadOnly(i, 4, True)
            
            # 5. Tempo (HH:MM:SS)
            dur = v.get('duration')
            self.grid.SetCellValue(i, 5, format_seconds(dur))
            self.grid.SetReadOnly(i, 5, True)
            
            # 6. Tokens
            t = v.get('token_count', 0)
            self.grid.SetCellValue(i, 6, str(t))
            self.grid.SetReadOnly(i, 6, True)

    def on_header_click(self, event):
        if event.GetCol() == 0:
            rows = self.grid.GetNumberRows()
            if rows == 0: return
            # Verificar se o primeiro está marcado ("1") ou não ("")
            first_val = self.grid.GetCellValue(0, 0)
            new_val = "" if first_val == "1" else "1"
            
            for i in range(rows):
                self.grid.SetCellValue(i, 0, new_val)
            self.grid.ForceRefresh()
        else:
            event.Skip()

    def on_delete_selected(self, event):
        ids = []
        for i in range(self.grid.GetNumberRows()):
            if self.grid.GetCellValue(i, 0) == "1":
                ids.append(self.row_map_id[i])
        
        if not ids: return
        
        if wx.MessageBox(f"Apagar {len(ids)} itens?", "Confirmar", wx.YES_NO) == wx.ID_YES:
            for vid in ids:
                self.db_handler.delete_video(vid)
            self.refresh_data()
