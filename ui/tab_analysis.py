import wx
import wx.grid
from pubsub import pub
from ui.virtual_table import VirtualVideoTable

class TabAnalysis(wx.Panel):
    """
    ABA 2: Cockpit Analítico (Master-Detail)
    Master: VirtualVideoTable (Grid Virtualizada)
    Detail: Visualização de Transcrição
    Zero-Knowledge: Proibido importar TabBatch ou PanelDetail.
    Performance: 250ms Debouncing (Restart-on-Event).
    """
    def __init__(self, parent):
        super().__init__(parent)
        self._init_ui()
        self._init_logic()
        self._bind_events()

    def _init_ui(self):
        # 1. Topologia via SplitterWindow (Cláusula Pétrea)
        self.splitter = wx.SplitterWindow(self, style=wx.SP_3D | wx.SP_LIVE_UPDATE)
        
        # 1.1 Master (Topo): Grid Virtualizada
        self.pnl_master = wx.Panel(self.splitter)
        master_sizer = wx.BoxSizer(wx.VERTICAL)
        
        self.grid = wx.grid.Grid(self.pnl_master)
        # Integração com VirtualVideoTable (SSoT)
        self.table = VirtualVideoTable()
        self.grid.SetTable(self.table, takeOwnership=True)
        
        master_sizer.Add(self.grid, 1, wx.EXPAND)
        self.pnl_master.SetSizer(master_sizer)
        
        # 1.2 Detail (Base): Expansão de Células / Transcrição
        self.pnl_detail = wx.Panel(self.splitter)
        detail_sizer = wx.BoxSizer(wx.VERTICAL)
        self.txt_detail = wx.TextCtrl(self.pnl_detail, style=wx.TE_MULTILINE | wx.TE_READONLY)
        detail_sizer.Add(self.txt_detail, 1, wx.EXPAND)
        self.pnl_detail.SetSizer(detail_sizer)
        
        # Configurar Splitter
        self.splitter.SplitHorizontally(self.pnl_master, self.pnl_detail, 350)
        self.splitter.SetMinimumPaneSize(100)
        
        main_sizer = wx.BoxSizer(wx.VERTICAL)
        main_sizer.Add(self.splitter, 1, wx.EXPAND)
        self.SetSizer(main_sizer)

    def _init_logic(self):
        # Timer de Debouncing Mandatário (250ms)
        self.debounce_timer = wx.Timer(self)
        
    def _bind_events(self):
        self.Bind(wx.EVT_TIMER, self.on_debounce_tick, self.debounce_timer)
        # Assinatura de eventos PubSub
        pub.subscribe(self.on_data_signal, 'TASK_COMPLETED')
        pub.subscribe(self.on_data_signal, 'TASK_PROGRESS')

    def on_data_signal(self, **kwargs):
        """
        Gatilho de Reatividade: Reinicia o timer de 250ms a cada evento (Restart-on-Event).
        Isso garante que 10.000 eventos seguidos causem apenas UM refresh no silêncio final.
        """
        if not self.debounce_timer.IsRunning():
            self.debounce_timer.Start(250, oneShot=True)
        else:
            self.debounce_timer.Stop()
            self.debounce_timer.Start(250, oneShot=True)

    def on_debounce_tick(self, event):
        """Atualização efetiva da Grid após período de calmaria."""
        # A implementação final chamará AppState.get_all_videos() p/ popular a table
        wx.CallAfter(self._refresh_grid)

    def _refresh_grid(self):
        # self.table.UpdateData(AppState().get_all_videos())
        # self.grid.ForceRefresh()
        pass
