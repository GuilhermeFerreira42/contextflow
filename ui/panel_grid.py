import wx
import wx.grid
import webbrowser
import threading
from core.processor import Processor
from core.app_state import AppState
from core.pubsub import PubSub
from services.export_service import ExportService
from ui.virtual_table import VirtualVideoTable

class GridPanel(wx.Panel):
    def __init__(self, parent, on_data_changed=None, log_callback=None, app_state=None):
        super().__init__(parent)
        self.app_state = app_state or AppState()
        self.db_handler = self.app_state.db_handler

        self.table = VirtualVideoTable()
        
        self.app_state.register_observer(self.on_app_state_updated)
        
        # PubSub Subscriptions
        PubSub.subscribe('TASK_PROGRESS', self.on_task_progress)
        PubSub.subscribe('TASK_ERROR', self.on_task_error)
        PubSub.subscribe('TASK_COMPLETED', self.on_task_completed)
        
        self.processor = Processor(self.app_state)
        self.processor.start_processing() 
        
        self._init_ui()
        self.refresh_table()

    def _init_ui(self):
        main_sizer = wx.BoxSizer(wx.VERTICAL)
        
        # Header
        lbl = wx.StaticText(self, label="Dashboard")
        lbl.SetFont(wx.Font(12, wx.FONTFAMILY_DEFAULT, wx.FONTSTYLE_NORMAL, wx.FONTWEIGHT_BOLD))
        main_sizer.Add(lbl, 0, wx.ALL, 10)

        # Input
        input_sizer = wx.StaticBoxSizer(wx.VERTICAL, self, "Adicionar URLs")
        self.txt_input = wx.TextCtrl(self, style=wx.TE_MULTILINE, size=(-1, 60))
        input_sizer.Add(self.txt_input, 1, wx.EXPAND | wx.ALL, 5)
        
        btn_sizer = wx.BoxSizer(wx.HORIZONTAL)
        btn_proc = wx.Button(self, label="Processar Fila", size=(180, 40))
        btn_proc.Bind(wx.EVT_BUTTON, self.on_click_process)
        btn_sizer.Add(btn_proc, 0, wx.RIGHT, 5)
        btn_clear = wx.Button(self, label="Limpar", size=(180, 40))
        btn_clear.Bind(wx.EVT_BUTTON, lambda e: self.txt_input.Clear())
        btn_sizer.Add(btn_clear, 0)
        input_sizer.Add(btn_sizer, 0, wx.EXPAND | wx.ALL, 5)
        main_sizer.Add(input_sizer, 0, wx.EXPAND | wx.ALL, 5)

        # Grid
        self.grid = wx.grid.Grid(self)
        self.grid.SetTable(self.table, takeOwnership=True)
        # Default Sizes
        sizes = [40, 80, 200, 300, 150, 90, 120, 150, 70, 60, 100]
        for i, s in enumerate(sizes):
            self.grid.SetColSize(i, s)
        
        self.grid.Bind(wx.grid.EVT_GRID_CELL_LEFT_CLICK, self.on_cell_click)
        self.grid.GetGridWindow().Bind(wx.EVT_MOTION, self.on_grid_motion)
        
        main_sizer.Add(self.grid, 1, wx.EXPAND | wx.ALL, 5)
        
        # Actions
        action_sizer = wx.BoxSizer(wx.HORIZONTAL)
        self.lbl_status = wx.StaticText(self, label="Pronto.")
        action_sizer.Add(self.lbl_status, 1, wx.ALIGN_CENTER_VERTICAL)
        
        for label, handler in [("Excluir", self.on_delete), ("Unificar (.md)", self.on_unify), ("Exportar (ZIP)", self.on_export)]:
            btn = wx.Button(self, label=label)
            btn.Bind(wx.EVT_BUTTON, handler)
            action_sizer.Add(btn, 0, wx.ALIGN_CENTER_VERTICAL | wx.RIGHT, 5)
        
        main_sizer.Add(action_sizer, 0, wx.EXPAND | wx.ALL, 5)
        self.SetSizer(main_sizer)

    def refresh_table(self):
        full_data = self.app_state.get_active_downloads() + self.app_state.get_all_videos()
        self.table.UpdateData(full_data)
        self.grid.ForceRefresh()

    def on_app_state_updated(self, event_type, data):
        if not wx.IsMainThread():
            wx.CallAfter(self.on_app_state_updated, event_type, data)
            return
        self.refresh_table()

    def on_click_process(self, event):
        txt = self.txt_input.GetValue().strip()
        if txt:
            self.processor.add_urls(txt)
            self.txt_input.Clear()

    def on_cell_click(self, event):
        row, col = event.GetRow(), event.GetCol()
        if col == 0:
            val = self.table.GetValue(row, 0)
            self.table.SetValue(row, 0, "0" if val == "1" else "1")
            self.grid.ForceRefresh()
        elif col == 2:
            url = self.table.GetValue(row, 2)
            if url.startswith('http'): webbrowser.open(url)
        event.Skip()

    def on_grid_motion(self, event):
        x, y = self.grid.CalcUnscrolledPosition(event.GetX(), event.GetY())
        row, col = self.grid.XYToCell(x, y)
        if col == 2 and row >= 0:
            self.grid.SetCursor(wx.Cursor(wx.CURSOR_HAND))
        else:
            self.grid.SetCursor(wx.Cursor(wx.CURSOR_ARROW))
        event.Skip()
    
    def on_delete(self, event):
        ids = list(self.table.selected_ids)
        if ids and wx.MessageBox(f"Apagar {len(ids)}?", "Confirma", wx.YES_NO) == wx.YES:
            self.app_state.delete_videos(ids)
            self.table.selected_ids.clear()
            self.refresh_table()

    def on_unify(self, event): self._run_export("markdown_single", "*.md")
    def on_export(self, event): self._run_export("zip", "*.zip")

    # PubSub Handlers
    def on_task_progress(self, video_id, status_msg):
        wx.CallAfter(self.lbl_status.SetLabel, f"[{video_id}] {status_msg}")

    def on_task_error(self, video_id, error_msg):
        wx.CallAfter(self.lbl_status.SetLabel, f"Erro [{video_id}]: {error_msg}")

    def on_task_completed(self, video_id, data_dict):
        wx.CallAfter(self.lbl_status.SetLabel, f"Concluído: {data_dict.get('title')}")

    def _run_export(self, fmt, wildcard):
        ids = list(self.table.selected_ids)
        if not ids: return
        with wx.FileDialog(self, "Salvar", wildcard=wildcard, style=wx.FD_SAVE | wx.FD_OVERWRITE_PROMPT) as dlg:
            if dlg.ShowModal() == wx.ID_OK:
                self.run_export_thread(ids, fmt, dlg.GetPath())

    def run_export_thread(self, ids, fmt, path):
        pd = wx.ProgressDialog("Exportando...", "Iniciando...", maximum=len(ids), parent=self, style=wx.PD_APP_MODAL | wx.PD_AUTO_HIDE)
        def update_progress(current, total, msg):
            def _ui():
                if pd: 
                    pd.Update(current, msg)
                    if current >= total: wx.MessageBox("Concluído!", "Sucesso")
            wx.CallAfter(_ui)
        
        service = ExportService(self.app_state)
        threading.Thread(target=service.export_batch, args=(ids, fmt, path, update_progress), daemon=True).start()