# contextflow/ui/tab_analysis.py
import wx
import wx.grid
import os
import webbrowser
from core.app_state import AppState
from core.pubsub import PubSub
from ui.virtual_table import VirtualVideoTable
from constants import COLOR_BG, COLOR_FG, COLOR_ACCENT, COLOR_HIGHLIGHT

class TabAnalysis(wx.Panel):
    """
    ABA 2: Cockpit Analítico (Master-Detail)
    Foco: Visualização rica, Thumbnails e Análise de Conteúdo.
    Design: Modern/Tailwind (v6.0).
    """
    def __init__(self, parent):
        super().__init__(parent)
        self.app_state = AppState()
        self.SetBackgroundColour(COLOR_BG)
        
        # Colunas Analíticas [Specs 5.9 Expansion]
        self.col_labels = [
            " # ", "Preview", "Título", "Canal", "Duração", 
            "Tags", "Link", "Status", "Resumo"
        ]
        self.table = VirtualVideoTable(col_labels=self.col_labels)
        
        self.debounce_timer = wx.Timer(self)
        self.last_selected_row = -1
        
        self._init_ui()
        self._bind_events()
        
        # Registro como Observador
        self.app_state.register_observer(self.on_state_mutation)
        
        # Garante refresh inicial
        wx.CallAfter(self._refresh_grid)

    def _init_ui(self):
        main_sizer = wx.BoxSizer(wx.VERTICAL)
        
        # --- TOOLBAR ANALÍTICA (Modern Style) ---
        self.toolbar = wx.Panel(self)
        self.toolbar.SetBackgroundColour(COLOR_BG)
        self.toolbar.SetMinSize((-1, 40))
        tb_sizer = wx.BoxSizer(wx.HORIZONTAL)
        
        # Botões Placeholder (Esterilização Funcional v5.9)
        btn_summarize = wx.Button(self.toolbar, label="✨ Batch Summarize")
        btn_summarize.SetBackgroundColour(COLOR_ACCENT)
        btn_summarize.SetForegroundColour(wx.WHITE)
        btn_summarize.SetFont(wx.Font(9, wx.FONTFAMILY_DEFAULT, wx.FONTSTYLE_NORMAL, wx.FONTWEIGHT_BOLD))
        
        btn_export = wx.Button(self.toolbar, label="📁 Export ZIP/MD")
        btn_export.SetBackgroundColour(wx.Colour(50, 50, 50))
        btn_export.SetForegroundColour(COLOR_FG)
        
        self.search = wx.SearchCtrl(self.toolbar)
        self.search.SetDescriptiveText("Filtro rápido...")
        self.search.ShowCancelButton(True)
        
        tb_sizer.Add(btn_summarize, 0, wx.CENTER | wx.LEFT, 10)
        tb_sizer.Add(btn_export, 0, wx.CENTER | wx.LEFT, 5)
        tb_sizer.AddStretchSpacer()
        tb_sizer.Add(self.search, 0, wx.CENTER | wx.RIGHT, 10)
        
        self.toolbar.SetSizer(tb_sizer)
        main_sizer.Add(self.toolbar, 0, wx.EXPAND | wx.BOTTOM, 1)
        
        # --- SPLITTER WINDOW (Master-Detail) ---
        self.splitter = wx.SplitterWindow(self, style=wx.SP_3D | wx.SP_LIVE_UPDATE | wx.SP_NO_XP_THEME)
        self.splitter.SetBackgroundColour(wx.Colour(230, 230, 230)) # COLOR_BORDER Light
        
        # MASTER PANEL (Top)
        self.pnl_master = wx.Panel(self.splitter)
        self.pnl_master.SetBackgroundColour(COLOR_BG)
        master_sizer = wx.BoxSizer(wx.VERTICAL)
        
        self.grid = wx.grid.Grid(self.pnl_master)
        self.grid.SetTable(self.table, takeOwnership=True)
        self.grid.SelectionMode = wx.grid.Grid.GridSelectRows
        
        # Estética HeidiSQL/Modern
        self.grid.SetColLabelSize(32)
        self.grid.SetRowLabelSize(0)
        self.grid.SetDefaultRowSize(52) # Conforto para Preview 80x45
        self.grid.SetGridLineColour(wx.Colour(40, 40, 40))
        
        # Larguras Fixas
        self.grid.SetColSize(0, 40)   # #
        self.grid.SetColSize(1, 90)   # Preview
        self.grid.SetColSize(2, 280)  # Título
        self.grid.SetColSize(3, 120)  # Canal
        self.grid.SetColSize(4, 70)   # Duração
        self.grid.SetColSize(5, 120)  # Tags
        self.grid.SetColSize(6, 40)   # Link
        self.grid.SetColSize(7, 60)   # Status
        self.grid.SetColSize(8, 300)  # Resumo
        
        master_sizer.Add(self.grid, 1, wx.EXPAND)
        self.pnl_master.SetSizer(master_sizer)
        
        # DETAIL PANEL (Bottom)
        self.pnl_detail = wx.Panel(self.splitter)
        self.pnl_detail.SetBackgroundColour(COLOR_BG) # Adaptado para Light Mode
        detail_sizer = wx.BoxSizer(wx.HORIZONTAL)
        
        # Lateral com Thumbnail Expandida e Controles
        self.pnl_side_info = wx.Panel(self.pnl_detail, size=(340, -1))
        side_sizer = wx.BoxSizer(wx.VERTICAL)
        
        # [CONTROLE MANUAL] Botão de Fechar Visualizador
        self.btn_close_viewer = wx.Button(self.pnl_side_info, label="✕ Fechar Visualizador", size=(-1, 30))
        self.btn_close_viewer.SetBackgroundColour(wx.Colour(230, 230, 230))
        self.btn_close_viewer.SetFont(wx.Font(9, wx.FONTFAMILY_DEFAULT, wx.FONTSTYLE_NORMAL, wx.FONTWEIGHT_BOLD))
        
        self.bmp_detail = wx.StaticBitmap(self.pnl_side_info, size=(320, 180))
        self.bmp_detail.SetBackgroundColour(wx.BLACK)
        
        self.lbl_side_title = wx.StaticText(self.pnl_side_info, label="Selecione um item")
        self.lbl_side_title.SetFont(wx.Font(11, wx.FONTFAMILY_DEFAULT, wx.FONTSTYLE_NORMAL, wx.FONTWEIGHT_BOLD))
        self.lbl_side_title.SetForegroundColour(COLOR_ACCENT)
        self.lbl_side_title.Wrap(320)
        
        side_sizer.Add(self.btn_close_viewer, 0, wx.ALL | wx.EXPAND, 5)
        side_sizer.Add(self.bmp_detail, 0, wx.ALL, 10)
        side_sizer.Add(self.lbl_side_title, 0, wx.LEFT | wx.RIGHT | wx.BOTTOM | wx.EXPAND, 10)
        self.pnl_side_info.SetSizer(side_sizer)
        
        # Conteúdo Textual
        self.txt_summary = wx.TextCtrl(self.pnl_detail, style=wx.TE_MULTILINE | wx.TE_READONLY | wx.TE_RICH2 | wx.NO_BORDER)
        self.txt_summary.SetBackgroundColour(COLOR_BG)
        self.txt_summary.SetForegroundColour(COLOR_FG)
        self.txt_summary.SetFont(wx.Font(10, wx.FONTFAMILY_DEFAULT, wx.FONTSTYLE_NORMAL, wx.FONTWEIGHT_NORMAL))
        
        detail_sizer.Add(self.pnl_side_info, 0, wx.EXPAND)
        detail_sizer.Add(self.txt_summary, 1, wx.EXPAND | wx.ALL, 10)
        self.pnl_detail.SetSizer(detail_sizer)
        
        # [SMART SHOW] Inicializa oculto
        self.splitter.SplitHorizontally(self.pnl_master, self.pnl_detail, -280)
        self.splitter.Unsplit(self.pnl_detail)
        
        main_sizer.Add(self.splitter, 1, wx.EXPAND)
        self.SetSizer(main_sizer)

    def _bind_events(self):
        self.grid.Bind(wx.grid.EVT_GRID_SELECT_CELL, self.on_select_video)
        self.grid.Bind(wx.grid.EVT_GRID_CELL_LEFT_CLICK, self.on_grid_click)
        self.btn_close_viewer.Bind(wx.EVT_BUTTON, lambda e: self.splitter.Unsplit(self.pnl_detail))
        self.Bind(wx.EVT_TIMER, self.on_debounce_tick, self.debounce_timer)
        self.search.Bind(wx.EVT_TEXT, self.on_search)

    def on_state_mutation(self, event_type, data=None):
        if event_type in ['VIDEO_ADDED', 'VIDEO_UPDATED', 'TASK_COMPLETED', 'DATA_LOADED']:
            wx.CallAfter(self.on_data_signal)

    def on_data_signal(self):
        """Debouncing 'Restart-on-Event' [Mandato 5.9]."""
        if self.debounce_timer.IsRunning():
            self.debounce_timer.Stop()
        self.debounce_timer.Start(250, oneShot=True)

    def on_debounce_tick(self, event):
        self._refresh_grid()

    def _refresh_grid(self):
        query = self.search.GetValue().lower()
        all_videos = self.app_state.get_all_videos()
        
        if query:
            filtered = [v for v in all_videos if query in v.get('title', '').lower() or query in v.get('channel_name', '').lower()]
            self.table.UpdateData(filtered)
        else:
            self.table.UpdateData(all_videos)
            
        self.grid.ForceRefresh()

    def on_search(self, event):
        self._refresh_grid()

    def on_grid_click(self, event):
        """Implementação de navegação direta via ícone [MANDATO v5.9]."""
        row, col = event.GetRow(), event.GetCol()
        label = self.col_labels[col].strip()
        
        if label == "Link":
            url = self.table.data[row].get('url')
            if url: webbrowser.open(url)
        event.Skip()

    def on_select_video(self, event):
        row = event.GetRow()
        if row != self.last_selected_row and row < len(self.table.data):
            self.last_selected_row = row
            video_data = self.table.data[row]
            vid_id = video_data.get('id')
            
            # Atualiza UI de Detalhe
            self.lbl_side_title.SetLabel(video_data.get('title', 'Unknown'))
            self.lbl_side_title.Wrap(320) # Re-wrap após mudar o texto
            
            # Carrega Thumbnail se existir
            thumb_path = video_data.get('thumbnail_path')
            if thumb_path and os.path.exists(thumb_path):
                try:
                    bmp = wx.Bitmap(thumb_path)
                    if bmp.IsOk():
                        # Redimensiona para o static bitmap
                        img = bmp.ConvertToImage().Rescale(320, 180, wx.IMAGE_QUALITY_HIGH)
                        self.bmp_detail.SetBitmap(wx.Bitmap(img))
                except:
                    self.bmp_detail.SetBitmap(wx.NullBitmap)
            else:
                self.bmp_detail.SetBitmap(wx.NullBitmap)

            # [LAZY LOADING] Resumo
            t_data = self.app_state.db_handler.get_transcript(vid_id)
            has_content = False
            if t_data:
                full_text = t_data.get('full_text', '')
                if full_text:
                    self.txt_summary.SetValue(full_text)
                    has_content = True
            
            if not has_content:
                self.txt_summary.SetValue("Nenhuma transcrição ou resumo disponível para este vídeo.")

            # [SMART SHOW] Expansão Inteligente
            # Se o vídeo tem resumo ou transcrição, mostramos o painel inferior
            if has_content or video_data.get('has_summary'):
                if not self.splitter.IsSplit():
                    self.splitter.SplitHorizontally(self.pnl_master, self.pnl_detail, -300)
            
        event.Skip()
