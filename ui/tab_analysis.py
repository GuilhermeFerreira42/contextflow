# contextflow/ui/tab_analysis.py
import wx
import wx.grid
from pubsub import pub
from core.app_state import AppState
from ui.virtual_table import VirtualVideoTable

class TabAnalysis(wx.Panel):
    """
    ABA 2: Cockpit Analítico (Master-Detail)
    Master: VirtualVideoTable (Grid Virtualizada baseada em AppState).
    Detail: Visualização de transcrições e metadados.
    Protocolo: Zero-Knowledge e Debouncing Restart-on-Event. [4, 5]
    """
    def __init__(self, parent):
        super().__init__(parent)
        self.app_state = AppState()
        
        # Inicialização da Tabela Virtual (SSoT) [6, 7]
        self.table = VirtualVideoTable()
        
        self._init_ui()
        self._init_logic()
        self._bind_events()

    def _init_ui(self):
        # Layout dinâmico via SplitterWindow [2, 5]
        self.splitter = wx.SplitterWindow(self, style=wx.SP_3D | wx.SP_LIVE_UPDATE)
        
        # --- Painel MASTER (Topo: Grid) ---
        self.pnl_master = wx.Panel(self.splitter)
        master_sizer = wx.BoxSizer(wx.VERTICAL)
        
        self.grid = wx.grid.Grid(self.pnl_master)
        # Conecta a Grid ao motor de virtualização [8]
        self.grid.SetTable(self.table, takeOwnership=True)
        self.grid.SelectionMode = wx.grid.Grid.GridSelectRows
        
        # Configuração estética da Grid
        self.grid.SetColLabelSize(30)
        self.grid.SetRowLabelSize(0) # Ocultar números de linha para performance [9]
        
        master_sizer.Add(self.grid, 1, wx.EXPAND)
        self.pnl_master.SetSizer(master_sizer)
        
        # --- Painel DETAIL (Base: Conteúdo) ---
        self.pnl_detail = wx.Panel(self.splitter)
        detail_sizer = wx.BoxSizer(wx.VERTICAL)
        
        # Label de identificação do detalhe
        self.lbl_info = wx.StaticText(self.pnl_detail, label=" Detalhes do Vídeo Selecionado:")
        self.lbl_info.SetForegroundColour(wx.Colour(100, 100, 100))
        
        self.txt_content = wx.TextCtrl(
            self.pnl_detail, 
            style=wx.TE_MULTILINE | wx.TE_READONLY | wx.TE_RICH2
        )
        # Estilo escuro para o painel de leitura [10]
        self.txt_content.SetBackgroundColour(wx.Colour(30, 30, 30))
        self.txt_content.SetForegroundColour(wx.Colour(220, 220, 220))
        
        detail_sizer.Add(self.lbl_info, 0, wx.ALL, 5)
        detail_sizer.Add(self.txt_content, 1, wx.EXPAND | wx.LEFT | wx.RIGHT | wx.BOTTOM, 5)
        self.pnl_detail.SetSizer(detail_sizer)
        
        # Configuração do Splitter (Proporção Inicial) [11]
        self.splitter.SplitHorizontally(self.pnl_master, self.pnl_detail, 400)
        self.splitter.SetMinimumPaneSize(150)
        
        main_sizer = wx.BoxSizer(wx.VERTICAL)
        main_sizer.Add(self.splitter, 1, wx.EXPAND)
        self.SetSizer(main_sizer)

    def _init_logic(self):
        # Timer de Debouncing Mandatário conforme PHASE_5_7_SPECS [4]
        self.debounce_timer = wx.Timer(self)

    def _bind_events(self):
        # Eventos de UI
        self.grid.Bind(wx.grid.EVT_GRID_SELECT_CELL, self.on_select_video)
        self.Bind(wx.EVT_TIMER, self.on_debounce_tick, self.debounce_timer)
        
        # Assinatura de Eventos PubSub (Fonte Única de Verdade) [12, 13]
        pub.subscribe(self.on_data_signal, 'TASK_COMPLETED')
        pub.subscribe(self.on_data_signal, 'VIDEO_UPDATED')
        pub.subscribe(self.on_data_signal, 'VIDEOS_DELETED')

    def on_data_signal(self, **kwargs):
        """
        Lógica de RESTART-ON-EVENT: 
        Reinicia o timer de 250ms a cada novo sinal de dados recebido. [3, 4, 14]
        """
        if self.debounce_timer.IsRunning():
            self.debounce_timer.Stop()
        
        self.debounce_timer.Start(250, oneShot=True)

    def on_debounce_tick(self, event):
        """Executa o refresh da Grid apenas no silêncio dos eventos."""
        wx.CallAfter(self._refresh_grid)

    def _refresh_grid(self):
        # Busca snapshot atômico do AppState [15]
        new_data = self.app_state.get_all_videos()
        # Atualiza a tabela virtual e força o redesenho [16]
        self.table.UpdateData(new_data)
        self.grid.ForceRefresh()

    def on_select_video(self, event):
        """Fluxo Master-Detail: Carrega detalhes ao selecionar linha."""
        row = event.GetRow()
        if row < self.table.GetNumberRows():
            video_data = self.table.data[row]
            video_id = video_data.get('id')
            
            # Busca transcrição pesada via DB apenas sob demanda (Lazy Loading) [17]
            transcript = self.app_state.db_handler.get_transcript(video_id)
            text = transcript['full_text'] if transcript else "(Sem transcrição disponível)"
            
            self.txt_content.SetValue(text)
            self.lbl_info.SetLabel(f" Detalhes: {video_data.get('title', '...')}")
        
        event.Skip()