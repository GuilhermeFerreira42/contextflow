# contextflow/ui/tab_analysis.py
import wx
import wx.grid
import os
import webbrowser
import markdown
try:
    import wx.html2 as html
    WEBVIEW_AVAILABLE = True
except ImportError:
    WEBVIEW_AVAILABLE = False

from core.app_state import AppState
from core.pubsub import PubSub
from ui.virtual_table import VirtualVideoTable

class TabAnalysis(wx.Panel):
    """
    ABA 2: Cockpit Analítico (Master-Detail)
    Foco: Visualização rica, Thumbnails e Análise de Conteúdo.
    Design: Modern Premium (Phase 6.1.1).
    """
    def __init__(self, parent):
        super().__init__(parent)
        self.app_state = AppState()
        self.app_state.theme_manager.apply_theme(self)
        
        # Colunas Analíticas [Specs 5.9 Expansion]
        self.col_labels = [
            " [x] ", " # ", "Preview", "Título", "Canal", "Duração", 
            "Publicado", "Adicionado", "Playlist", "Tokens", "Tags", "Link", "Status", "Resumo"
        ]
        self.table = VirtualVideoTable(col_labels=self.col_labels)
        
        self.debounce_timer = wx.Timer(self)
        self.last_selected_row = -1
        
        self._init_ui()
        self._bind_events()
        
        # [FASE 6] Subscrições de Streaming
        PubSub.subscribe('SUMMARY_STREAM', self.on_summary_stream)
        PubSub.subscribe('SUMMARY_COMPLETED', self.on_summary_completed)
        PubSub.subscribe('SUMMARY_STARTED', self.on_summary_started)
        
        # Registro como Observador
        self.app_state.register_observer(self.on_state_mutation)
        
        # Garante refresh inicial
        wx.CallAfter(self._refresh_grid)

    def _init_ui(self):
        main_sizer = wx.BoxSizer(wx.VERTICAL)
        
        # --- TOOLBAR ANALÍTICA ---
        self.toolbar = wx.Panel(self)
        self.app_state.theme_manager.apply_theme(self.toolbar)
        self.toolbar.SetMinSize((-1, 40))
        tb_sizer = wx.BoxSizer(wx.HORIZONTAL)
        
        btn_summarize = wx.Button(self.toolbar, label="✨ Resumo em Lote")
        btn_summarize.SetBackgroundColour(self.app_state.theme_manager.COLOR_ACCENT)
        btn_summarize.SetForegroundColour(wx.WHITE)
        btn_summarize.SetFont(wx.Font(9, wx.FONTFAMILY_DEFAULT, wx.FONTSTYLE_NORMAL, wx.FONTWEIGHT_BOLD))
        
        self.btn_export = wx.Button(self.toolbar, label="📁 Export ZIP/MD")
        self.btn_export.SetBackgroundColour(self.app_state.theme_manager.COLOR_SECONDARY)
        
        self.btn_cancel = wx.Button(self.toolbar, label="🛑 Cancelar")
        self.btn_cancel.SetForegroundColour(self.app_state.theme_manager.COLOR_WARNING)
        
        self.btn_triage = wx.ToggleButton(self.toolbar, label="👁️ Modo Pro")
        self.btn_triage.SetValue(self.app_state.triage_mode)
        self._update_triage_ui()
        
        from ui.components.status_chip import StatusChip
        self.status_chip = StatusChip(self.toolbar)
        
        self.search = wx.SearchCtrl(self.toolbar)
        self.search.SetDescriptiveText("Filtro rápido...")
        self.search.ShowCancelButton(True)
        
        tb_sizer.Add(btn_summarize, 0, wx.CENTER | wx.LEFT, 10)
        tb_sizer.Add(self.btn_export, 0, wx.CENTER | wx.LEFT, 5)
        tb_sizer.Add(self.btn_cancel, 0, wx.CENTER | wx.LEFT, 5)
        tb_sizer.Add(self.btn_triage, 0, wx.CENTER | wx.LEFT, 5)
        tb_sizer.Add(self.status_chip, 0, wx.CENTER | wx.LEFT, 15)
        tb_sizer.AddStretchSpacer()
        tb_sizer.Add(self.search, 0, wx.CENTER | wx.RIGHT, 10)
        
        self.toolbar.SetSizer(tb_sizer)
        main_sizer.Add(self.toolbar, 0, wx.EXPAND | wx.BOTTOM, 1)
        
        # --- SPLITTER WINDOW ---
        self.splitter = wx.SplitterWindow(self, style=wx.SP_3D | wx.SP_LIVE_UPDATE | wx.SP_NO_XP_THEME)
        self.splitter.SetBackgroundColour(self.app_state.theme_manager.COLOR_BORDER)
        self.splitter.SetSashGravity(0.5) 
        self.splitter.SetMinimumPaneSize(50) 
        
        self.pnl_master = wx.Panel(self.splitter)
        self.app_state.theme_manager.apply_theme(self.pnl_master)
        master_sizer = wx.BoxSizer(wx.VERTICAL)
        
        self.grid = wx.grid.Grid(self.pnl_master)
        self.grid.SetTable(self.table, takeOwnership=True)
        self.grid.SelectionMode = wx.grid.Grid.GridSelectRows
        self.grid.SetColLabelSize(32)
        self.grid.SetRowLabelSize(0)
        self.grid.SetDefaultRowSize(52) 
        self.grid.SetGridLineColour(self.app_state.theme_manager.COLOR_BORDER)
        
        # Larguras de Colunas
        for i, width in enumerate([40, 40, 90, 350, 120, 70, 120, 160, 120, 80, 100, 40, 60, 250]):
            self.grid.SetColSize(i, width)
        
        # Carregamento de Larguras Persistidas
        for i in range(len(self.col_labels)):
            saved_width = self.app_state.config.get("ui", f"col_analysis_width_{i}")
            if saved_width: self.grid.SetColSize(i, int(saved_width))
        
        self.grid.DisableDragRowSize()
        master_sizer.Add(self.grid, 1, wx.EXPAND)
        self.pnl_master.SetSizer(master_sizer)
        
        # DETAIL PANEL
        self.pnl_detail = wx.Panel(self.splitter)
        self.app_state.theme_manager.apply_theme(self.pnl_detail)
        detail_main_sizer = wx.BoxSizer(wx.VERTICAL)
        
        from ui.components.telemetry_strip import TelemetryStrip
        self.telemetry_strip = TelemetryStrip(self.pnl_detail)
        detail_main_sizer.Add(self.telemetry_strip, 0, wx.EXPAND)
        
        content_sizer = wx.BoxSizer(wx.HORIZONTAL)
        self.pnl_side_info = wx.Panel(self.pnl_detail, size=(340, -1))
        self.app_state.theme_manager.apply_theme(self.pnl_side_info)
        side_sizer = wx.BoxSizer(wx.VERTICAL)
        
        self.btn_close_viewer = wx.Button(self.pnl_side_info, label="✕ Fechar Visualizador", size=(-1, 30))
        self.btn_close_viewer.SetBackgroundColour(self.app_state.theme_manager.COLOR_SECONDARY)
        self.bmp_detail = wx.StaticBitmap(self.pnl_side_info, size=(320, 180))
        self.bmp_detail.SetBackgroundColour(wx.BLACK)
        self.lbl_side_title = wx.StaticText(self.pnl_side_info, label="Selecione um item")
        self.lbl_side_title.SetFont(wx.Font(11, wx.FONTFAMILY_DEFAULT, wx.FONTSTYLE_NORMAL, wx.FONTWEIGHT_BOLD))
        self.lbl_side_title.SetForegroundColour(self.app_state.theme_manager.COLOR_ACCENT)
        self.lbl_side_title.Wrap(320)
        
        side_sizer.Add(self.btn_close_viewer, 0, wx.ALL | wx.EXPAND, 5)
        side_sizer.Add(self.bmp_detail, 0, wx.ALL, 10)
        side_sizer.Add(self.lbl_side_title, 0, wx.LEFT | wx.RIGHT | wx.BOTTOM | wx.EXPAND, 10)
        self.pnl_side_info.SetSizer(side_sizer)
        
        if WEBVIEW_AVAILABLE:
            try:
                self.display = html.WebView.New(self.pnl_detail)
            except Exception as e:
                self.display = wx.TextCtrl(self.pnl_detail, style=wx.TE_MULTILINE | wx.TE_READONLY | wx.TE_RICH2 | wx.NO_BORDER)
        else:
            self.display = wx.TextCtrl(self.pnl_detail, style=wx.TE_MULTILINE | wx.TE_READONLY | wx.TE_RICH2 | wx.NO_BORDER)
        
        self.display.SetBackgroundColour(self.app_state.theme_manager.COLOR_BG)
        content_sizer.Add(self.pnl_side_info, 0, wx.EXPAND)
        content_sizer.Add(self.display, 1, wx.EXPAND | wx.ALL, 10)
        detail_main_sizer.Add(content_sizer, 1, wx.EXPAND)
        self.pnl_detail.SetSizer(detail_main_sizer)
        
        self.splitter.SplitHorizontally(self.pnl_master, self.pnl_detail, -280)
        wx.CallAfter(self.splitter.Unsplit, self.pnl_detail)
        
        main_sizer.Add(self.splitter, 1, wx.EXPAND)
        self.SetSizer(main_sizer)

    def _bind_events(self):
        self.grid.Bind(wx.grid.EVT_GRID_SELECT_CELL, self.on_select_video)
        self.grid.Bind(wx.grid.EVT_GRID_CELL_RIGHT_CLICK, self.on_right_click)
        self.btn_close_viewer.Bind(wx.EVT_BUTTON, self.on_close_viewer)
        self.search.Bind(wx.EVT_TEXT, self.on_search)
        self.grid.Bind(wx.grid.EVT_GRID_CELL_LEFT_DCLICK, self.on_grid_dclick)
        self.grid.Bind(wx.EVT_KEY_DOWN, self.on_key_down)
        self.btn_export.Bind(wx.EVT_BUTTON, self.on_export_batch)
        self.btn_cancel.Bind(wx.EVT_BUTTON, self.on_cancel_all)
        self.grid.Bind(wx.grid.EVT_GRID_LABEL_LEFT_CLICK, self.on_label_click)
        self.Bind(wx.EVT_TIMER, self.on_debounce_tick, self.debounce_timer)
        self.grid.GetGridWindow().Bind(wx.EVT_MOTION, self.on_grid_motion)
        self.grid.Bind(wx.grid.EVT_GRID_CELL_LEFT_CLICK, self.on_grid_click)
        self.btn_triage.Bind(wx.EVT_TOGGLEBUTTON, self.on_toggle_triage)
        self.grid.Bind(wx.grid.EVT_GRID_COL_SIZE, self.on_col_size)

    def on_grid_dclick(self, event):
        row = event.GetRow()
        if row >= 0: self._load_row_details(row, expand=True)
        event.Skip()

    def on_select_video(self, event):
        row = event.GetRow()
        should_expand = not self.app_state.triage_mode or self.splitter.IsSplit()
        self._load_row_details(row, expand=should_expand)
        event.Skip()

    def on_state_mutation(self, event_type, data=None):
        if event_type in ['VIDEO_ADDED', 'VIDEO_UPDATED', 'TASK_COMPLETED', 'DATA_LOADED', 'VIDEOS_DELETED', 'VIDEO_PROMOTED', 'SELECTION_CHANGED']:
            wx.CallAfter(self.on_data_signal)

    def on_data_signal(self):
        if self.debounce_timer.IsRunning(): self.debounce_timer.Stop()
        self.debounce_timer.Start(250, oneShot=True)

    def on_debounce_tick(self, event): self._refresh_grid()

    def _refresh_grid(self):
        query = self.search.GetValue().lower()
        all_videos = self.app_state.get_unified_data()
        filtered = [v for v in all_videos if query in str(v.get('title', '')).lower() or query in str(v.get('channel_name', '')).lower()] if query else all_videos
        self.table.UpdateData(filtered)
        self.grid.ForceRefresh()

    def on_search(self, event): self._refresh_grid()

    def on_label_click(self, event):
        col = event.GetCol()
        if col == 0:
             if not self.table.data: return
             is_first_selected = (self.table.GetValue(0, 0) == "1")
             new_selection = set()
             if not is_first_selected:
                 for item in self.table.data:
                     vid = item.get('id') or item.get('uuid')
                     if vid: new_selection.add(vid)
             self.table.selected_ids = new_selection
             self.grid.ForceRefresh()
             return
        if col >= 0: self._sort_grid(col)
        event.Skip()

    def _sort_grid(self, col):
        if not self.table.data: return
        if self.table.sort_col == col: self.table.sort_ascending = not self.table.sort_ascending
        else: self.table.sort_col = col; self.table.sort_ascending = True
        label = self.table.col_labels[col].strip()
        mapping = {'Título': 'title', 'Canal': 'channel_name', 'Duração': 'duration', 'Status': 'status', 'Publicado': 'upload_date', 'Adicionado': 'added_at', 'Link': 'url', 'Tags': 'tags', 'Resumo': 'transcript_snippet', 'Playlist': 'playlist_title', 'Tokens': 'token_count'}
        key = mapping.get(label)
        if key:
            def sort_val(x):
                val = x.get(key, "")
                if key == 'token_count':
                    try: return int(val or 0)
                    except: return 0
                return str(val).lower()
            self.table.data.sort(key=sort_val, reverse=not self.table.sort_ascending)
            self.grid.ForceRefresh()

    def on_grid_motion(self, event):
        pos = event.GetPosition()
        coords = self.grid.XYToCell(self.grid.CalcUnscrolledPosition(pos).x, self.grid.CalcUnscrolledPosition(pos).y)
        col = coords.GetCol()
        self.grid.GetGridWindow().SetCursor(wx.Cursor(wx.CURSOR_HAND if col >= 0 and self.col_labels[col].strip() == "Link" else wx.CURSOR_ARROW))
        event.Skip()

    def on_right_click(self, event):
        row = event.GetRow()
        if row < 0 or row >= len(self.table.data): return
        self.grid.SetGridCursor(row, event.GetCol())
        video_data = self.table.data[row]
        vid = video_data.get('id') or video_data.get('uuid')
        menu = wx.Menu()
        menu.Append(wx.ID_ANY, "🗑️ Excluir").Bind(wx.EVT_MENU, lambda e: self.app_state.delete_videos([vid]) if wx.MessageBox("Excluir?", "Confirma", wx.YES_NO)==wx.YES else None)
        menu.Append(wx.ID_ANY, "🔗 Abrir Link").Bind(wx.EVT_MENU, lambda e: webbrowser.open(video_data.get('url')))
        self.PopupMenu(menu)
        menu.Destroy()

    def on_grid_click(self, event):
        row, col = event.GetRow(), event.GetCol()
        label = self.col_labels[col].strip()
        if label == "[x]":
            val = self.table.GetValue(row, col)
            self.table.SetValue(row, col, "0" if val == "1" else "1")
            self.grid.ForceRefresh()
        elif label == "Link":
            url = self.table.data[row].get('url')
            if url: webbrowser.open(url)
        elif label == "Resumo":
            item = self.table.data[row]
            if not item.get('summary_text'): PubSub.publish('REQUEST_SUMMARY', video_id=item.get('id'))
            else: self._load_row_details(row)
        event.Skip()

    def _load_row_details(self, row, expand=True):
        if row >= 0 and row < len(self.table.data):
            self.last_selected_row = row
            video_data = self.table.data[row]
            self.lbl_side_title.SetLabel(video_data.get('title', 'Unknown'))
            self.lbl_side_title.Wrap(320)
            thumb_path = video_data.get('thumbnail_path')
            if thumb_path and os.path.exists(thumb_path):
                try:
                    bmp = wx.Bitmap(thumb_path)
                    if bmp.IsOk():
                        img = bmp.ConvertToImage().Rescale(320, 180, wx.IMAGE_QUALITY_HIGH)
                        self.bmp_detail.SetBitmap(wx.Bitmap(img))
                except: self.bmp_detail.SetBitmap(wx.NullBitmap)
            else: self.bmp_detail.SetBitmap(wx.NullBitmap)
            summary_text = video_data.get('summary_text', '') or self.app_state._live_analysis_buffer.get(video_data.get('id'), '')
            if not summary_text:
                t_data = self.app_state.db_handler.get_transcript(video_data.get('id'))
                summary_text = f"### Transcrição\n\n{t_data['full_text']}" if t_data else "Sem conteúdo."
            self._update_display(summary_text)
            if expand and not self.splitter.IsSplit(): self.splitter.SplitHorizontally(self.pnl_master, self.pnl_detail, -320)

    def _update_display(self, text):
        if WEBVIEW_AVAILABLE:
            html_content = markdown.markdown(text, extensions=['extra', 'codehilite'])
            css = self.app_state.theme_manager.get_webview_css()
            self.display.SetPage(f"<html><head><style>{css}</style></head><body>{html_content}</body></html>", "")
        else: self.display.SetValue(text)

    def on_summary_started(self, video_id):
        if video_id == self._get_current_vid():
            if not self.splitter.IsSplit(): self.splitter.SplitHorizontally(self.pnl_master, self.pnl_detail, -320)
            wx.CallAfter(self._update_display, "### ✨ Gerando resumo inteligente...")

    def on_summary_stream(self, video_id, text):
        if video_id == self._get_current_vid():
            if not self.splitter.IsSplit(): self.splitter.SplitHorizontally(self.pnl_master, self.pnl_detail, -320)
            wx.CallAfter(self._update_display, text)

    def on_summary_completed(self, video_id):
        wx.CallAfter(self._refresh_grid)
        if video_id == self._get_current_vid(): wx.CallAfter(self._load_row_details, self.last_selected_row)

    def _get_current_vid(self):
        return self.table.data[self.last_selected_row].get('id') if 0 <= self.last_selected_row < len(self.table.data) else None

    def on_close_viewer(self, event):
        self.splitter.Unsplit(self.pnl_detail)
        self.last_selected_row = -1

    def on_key_down(self, event):
        key = event.GetKeyCode()
        if key == wx.WXK_SPACE:
            rows = self.grid.GetSelectedRows() or [self.grid.GetGridCursorRow()]
            if rows[0] >= 0:
                new_val = "0" if self.table.GetValue(rows[0], 0) == "1" else "1"
                for r in rows: self.table.SetValue(r, 0, new_val)
                self.grid.ForceRefresh()
        elif key == wx.WXK_RETURN:
            row = self.grid.GetGridCursorRow()
            if row >= 0: self._load_row_details(row, expand=True)
        elif key == wx.WXK_DELETE: self.on_delete_selected(None)
        else: event.Skip()

    def on_toggle_triage(self, event):
        self.app_state.triage_mode = self.btn_triage.GetValue()
        self._update_triage_ui()

    def _update_triage_ui(self):
        self.btn_triage.SetLabel("⚡ Modo Pro" if self.app_state.triage_mode else "👁️ Auto View")
        self.btn_triage.SetBackgroundColour(wx.Colour(255, 240, 200) if self.app_state.triage_mode else self.app_state.theme_manager.COLOR_SECONDARY)
        self.toolbar.Layout()

    def on_delete_selected(self, event):
        ids = list(self.table.selected_ids)
        if ids and wx.MessageBox(f"Excluir {len(ids)}?", "Confirma", wx.YES_NO)==wx.YES:
            self.app_state.delete_videos(ids)
            self.table.selected_ids.clear()
            self._refresh_grid()

    def on_export_batch(self, event):
        ids = list(self.table.selected_ids)
        if not ids: return
        with wx.FileDialog(self, "Exportar ZIP", wildcard="*.zip", style=wx.FD_SAVE | wx.FD_OVERWRITE_PROMPT) as fd:
            if fd.ShowModal() == wx.ID_OK:
                path = fd.GetPath()
                pd = wx.ProgressDialog("Exportando...", "Iniciando...", maximum=len(ids), parent=self)
                import threading
                from services.export_service import ExportService
                t = threading.Thread(target=ExportService(self.app_state).export_batch, args=(ids, "zip", path, lambda c, t, m: wx.CallAfter(pd.Update, c, m)), daemon=True)
                t.start()

    def on_cancel_all(self, event):
        if wx.MessageBox("Cancelar tudo?", "Confirma", wx.YES_NO)==wx.YES: PubSub.publish('REQUEST_CANCEL_ALL')

    def on_col_size(self, event):
        col = event.GetRowOrCol()
        self.app_state.config.set("ui", f"col_analysis_width_{col}", self.grid.GetColSize(col))
        event.Skip()
