# contextflow/ui/tab_analysis.py
import wx
import wx.grid
from core.app_state import AppState
from core.pubsub import PubSub
from ui.virtual_table import VirtualVideoTable

class TabAnalysis(wx.Panel):
    """
    ABA 2: Cockpit Analítico (Master-Detail)
    Foco: Visualização rica, Thumbnails e Análise de Conteúdo.
    Protocolo: [ZERO KNOWLEDGE] e [SMART SHOW].
    """
    def __init__(self, parent):
        super().__init__(parent)
        self.app_state = AppState()
        
        # Colunas específicas para o Cockpit Analítico (com Thumbnails)
        self.col_labels = [
            " # ", " [x] ", "Thumb", "Título", "Canal", 
            "Duração", "Tokens", "Status"
        ]
        self.table = VirtualVideoTable(col_labels=self.col_labels)
        
        self.debounce_timer = wx.Timer(self)
        self.last_selected_row = -1
        
        self._init_ui()
        self._bind_events()
        
        # [SSOT] Registro como Observador Oficial do Estado
        self.app_state.register_observer(self.on_state_mutation)
        
        self._refresh_grid()

    def _init_ui(self):
        main_sizer = wx.BoxSizer(wx.VERTICAL)
        
        # [MASTER-DETAIL] Splitter Window para visualização segregada
        self.splitter = wx.SplitterWindow(self, style=wx.SP_3D | wx.SP_LIVE_UPDATE)
        
        # --- PAINEL SUPERIOR: GRID (MASTER) ---
        self.pnl_master = wx.Panel(self.splitter)
        master_sizer = wx.BoxSizer(wx.VERTICAL)
        
        self.grid = wx.grid.Grid(self.pnl_master)
        self.grid.SetTable(self.table, takeOwnership=True)
        self.grid.SelectionMode = wx.grid.Grid.GridSelectRows
        
        # Ajustes de Layout Moderno
        self.grid.SetColLabelSize(30)
        self.grid.SetRowLabelSize(0)
        self.grid.SetDefaultRowSize(45) # Altura maior para thumbnails
        
        self.grid.SetColSize(0, 40)   # #
        self.grid.SetColSize(1, 40)   # [x]
        self.grid.SetColSize(2, 60)   # Thumb
        self.grid.SetColSize(3, 400)  # Título
        
        master_sizer.Add(self.grid, 1, wx.EXPAND | wx.ALL, 0)
        self.pnl_master.SetSizer(master_sizer)
        
        # --- PAINEL INFERIOR: DETALHES (DETAIL) ---
        self.pnl_detail = wx.Panel(self.splitter)
        detail_sizer = wx.BoxSizer(wx.VERTICAL)
        
        self.lbl_detail = wx.StaticText(self.pnl_detail, label=" Selecione um vídeo para análise completa ")
        self.lbl_detail.SetForegroundColour(wx.Colour(150, 150, 150))
        
        self.txt_analysis = wx.TextCtrl(self.pnl_detail, style=wx.TE_MULTILINE | wx.TE_READONLY | wx.TE_RICH2)
        self.txt_analysis.SetBackgroundColour(wx.Colour(25, 25, 25))
        self.txt_analysis.SetForegroundColour(wx.WHITE)
        
        detail_sizer.Add(self.lbl_detail, 0, wx.ALL, 10)
        detail_sizer.Add(self.txt_analysis, 1, wx.EXPAND | wx.LEFT | wx.RIGHT | wx.BOTTOM, 10)
        self.pnl_detail.SetSizer(detail_sizer)
        
        # [SMART SHOW] Inicializa o splitter com o detalhe minimizado ou oculto
        self.splitter.SplitHorizontally(self.pnl_master, self.pnl_detail, -150)
        self.splitter.SetMinimumPaneSize(50)
        self.splitter.Unsplit(self.pnl_detail) # Começa oculto até seleção
        
        main_sizer.Add(self.splitter, 1, wx.EXPAND)
        self.SetSizer(main_sizer)

    def _bind_events(self):
        self.grid.Bind(wx.grid.EVT_GRID_SELECT_CELL, self.on_select_video)
        self.grid.Bind(wx.grid.EVT_GRID_CELL_LEFT_CLICK, self.on_grid_click)
        self.Bind(wx.EVT_TIMER, self.on_debounce_tick, self.debounce_timer)

    def on_state_mutation(self, event_type, data=None):
        """Callback do AppState Observer (Garante Thread Safety)."""
        wx.CallAfter(self.on_data_signal)

    def on_data_signal(self, **kwargs):
        """Debouncing 'Restart-on-Event' de 250ms [REATIVE ENGINE]."""
        if self.debounce_timer.IsRunning():
            self.debounce_timer.Stop()
        self.debounce_timer.Start(250, oneShot=True)

    def on_debounce_tick(self, event):
        self._refresh_grid()

    def _refresh_grid(self):
        new_data = self.app_state.get_all_videos()
        self.table.UpdateData(new_data)
        self.grid.ForceRefresh()

    def on_grid_click(self, event):
        row, col = event.GetRow(), event.GetCol()
        if col == 1: # Toggle Checkbox
            val = self.table.GetValue(row, col)
            self.table.SetValue(row, col, "0" if val == "1" else "1")
            self.grid.ForceRefresh()
        event.Skip()

    def on_select_video(self, event):
        row = event.GetRow()
        if row != self.last_selected_row and row < len(self.table.data):
            self.last_selected_row = row
            video_data = self.table.data[row]
            
            # [LAZY LOADING] Carrega transcrição do banco
            t_data = self.app_state.db_handler.get_transcript(video_data.get('id'))
            content = t_data.get('full_text', '') if t_data else "(Sem conteúdo disponível para análise)"
            
            self.txt_analysis.SetValue(content)
            self.lbl_detail.SetLabel(f" Análise: {video_data.get('title', '...')}")
            
            # [SMART SHOW] Expande o splitter se houver conteúdo
            if not self.splitter.IsSplit():
                self.splitter.SplitHorizontally(self.pnl_master, self.pnl_detail, -250)
        
        event.Skip()