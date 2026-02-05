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
            " [x] ", " # ", "Preview", "Título", "Canal", "Duração", 
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
        
        self.btn_export = wx.Button(self.toolbar, label="📁 Export ZIP/MD")
        self.btn_export.SetBackgroundColour(wx.Colour(230, 230, 230))
        self.btn_export.SetForegroundColour(COLOR_FG)
        
        self.search = wx.SearchCtrl(self.toolbar)
        self.search.SetDescriptiveText("Filtro rápido...")
        self.search.ShowCancelButton(True)
        
        tb_sizer.Add(btn_summarize, 0, wx.CENTER | wx.LEFT, 10)
        tb_sizer.Add(self.btn_export, 0, wx.CENTER | wx.LEFT, 5)
        tb_sizer.AddStretchSpacer()
        tb_sizer.Add(self.search, 0, wx.CENTER | wx.RIGHT, 10)
        
        self.toolbar.SetSizer(tb_sizer)
        main_sizer.Add(self.toolbar, 0, wx.EXPAND | wx.BOTTOM, 1)
        
        # --- SPLITTER WINDOW (Master-Detail) ---
        self.splitter = wx.SplitterWindow(self, style=wx.SP_3D | wx.SP_LIVE_UPDATE | wx.SP_NO_XP_THEME)
        self.splitter.SetBackgroundColour(wx.Colour(230, 230, 230)) # COLOR_BORDER Light
        self.splitter.SetSashGravity(0.5) # [MANDATO 5.9] Redimensionamento proporcional
        self.splitter.SetMinimumPaneSize(50) # [REVERSIBILIDADE v5.9]
        
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
        self.grid.SetGridLineColour(wx.Colour(220, 220, 220)) # Light Gray lines for Light Mode
        
        # Larguras Fixas
        self.grid.SetColSize(0, 40)   # [x]
        self.grid.SetColSize(1, 40)   # #
        self.grid.SetColSize(2, 90)   # Preview
        self.grid.SetColSize(3, 380)  # Título (Aumentado para Modo Rico)
        self.grid.SetColSize(4, 120)  # Canal
        self.grid.SetColSize(5, 70)   # Duração
        self.grid.SetColSize(6, 120)  # Tags
        self.grid.SetColSize(7, 40)   # Link
        self.grid.SetColSize(8, 60)   # Status
        self.grid.SetColSize(9, 300)  # Resumo
        
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
        
        # [SMART SHOW] Inicializa oculto (Mandato 5.9)
        self.splitter.SplitHorizontally(self.pnl_master, self.pnl_detail, -280)
        wx.CallAfter(self.splitter.Unsplit, self.pnl_detail)
        
        main_sizer.Add(self.splitter, 1, wx.EXPAND)
        self.SetSizer(main_sizer)
        self.Layout()

    def _bind_events(self):
        self.grid.Bind(wx.grid.EVT_GRID_SELECT_CELL, self.on_select_video)
        self.grid.Bind(wx.grid.EVT_GRID_CELL_RIGHT_CLICK, self.on_right_click)
        self.btn_close_viewer.Bind(wx.EVT_BUTTON, lambda e: self.splitter.Unsplit(self.pnl_detail))
        self.search.Bind(wx.EVT_TEXT, self.on_search)
        
        # [FUNCIONALIDADE v5.9] Ativação do Botão Exportar
        self.btn_export.Bind(wx.EVT_BUTTON, self.on_export_batch)
        
        self.grid.Bind(wx.grid.EVT_GRID_LABEL_LEFT_CLICK, self.on_label_click)
        self.Bind(wx.EVT_TIMER, self.on_debounce_tick, self.debounce_timer)
        self.grid.GetGridWindow().Bind(wx.EVT_MOTION, self.on_grid_motion)
        self.grid.Bind(wx.grid.EVT_GRID_CELL_LEFT_CLICK, self.on_grid_click)

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
        # [SSOT v5.9] Usa dados unificados para visibilidade total do pipeline
        all_videos = self.app_state.get_unified_data()
        
        if query:
            filtered = [v for v in all_videos if query in str(v.get('title', '')).lower() or query in str(v.get('channel_name', '')).lower()]
            self.table.UpdateData(filtered)
        else:
            self.table.UpdateData(all_videos)
            
        self.grid.ForceRefresh()

    def on_search(self, event):
        self._refresh_grid()

    def on_label_click(self, event):
        col = event.GetCol()
        if col == 0: # Check All
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
        
        # Sort Column
        if col >= 0:
            self._sort_grid(col)
        event.Skip()

    def _sort_grid(self, col):
        if not self.table.data: return
        if self.table.sort_col == col:
            self.table.sort_ascending = not self.table.sort_ascending
        else:
            self.table.sort_col = col
            self.table.sort_ascending = True

        label = self.table.col_labels[col].strip()
        mapping = {
            'Título': 'title',
            'Canal': 'channel_name',
            'Duração': 'duration',
            'Status': 'status'
        }
        key = mapping.get(label)
        if key:
            self.table.data.sort(key=lambda x: str(x.get(key, "")).lower(), reverse=not self.table.sort_ascending)
            self.grid.ForceRefresh()

    def on_grid_motion(self, event):
        pos = event.GetPosition()
        coords = self.grid.XYToCell(self.grid.CalcUnscrolledPosition(pos).x, 
                                     self.grid.CalcUnscrolledPosition(pos).y)
        col = coords.GetCol()
        if col >= 0 and self.col_labels[col].strip() == "Link":
            self.grid.GetGridWindow().SetCursor(wx.Cursor(wx.CURSOR_HAND))
        else:
            self.grid.GetGridWindow().SetCursor(wx.Cursor(wx.CURSOR_ARROW))
        event.Skip()

    def on_right_click(self, event):
        row = event.GetRow()
        if row < 0 or row >= len(self.table.data): return
        
        self.grid.SelectRow(row)
        video_data = self.table.data[row]
        vid = video_data.get('id') or video_data.get('uuid')
        
        menu = wx.Menu()
        m_del = menu.Append(wx.ID_ANY, "🗑️ Excluir")
        m_link = menu.Append(wx.ID_ANY, "🔗 Abrir Link")
        m_copy = menu.Append(wx.ID_ANY, "📋 Copiar Link")
        m_md = menu.Append(wx.ID_ANY, "📄 Baixar como MD")
        m_sum = menu.Append(wx.ID_ANY, "✨ Resumir")
        
        self.Bind(wx.EVT_MENU, lambda e: self.app_state.delete_videos([vid]), m_del)
        self.Bind(wx.EVT_MENU, lambda e: webbrowser.open(video_data.get('url')), m_link)
        self.Bind(wx.EVT_MENU, lambda e: self._copy_to_clipboard(video_data.get('url')), m_copy)
        self.Bind(wx.EVT_MENU, lambda e: self._direct_export_md(video_data), m_md)
        self.Bind(wx.EVT_MENU, lambda e: wx.MessageBox("Funcionalidade da Fase 6 (Placeholder).", "AI Summary"), m_sum)
        
        self.PopupMenu(menu)
        menu.Destroy()

    def _copy_to_clipboard(self, text):
        if not text: return
        if wx.TheClipboard.Open():
            wx.TheClipboard.SetData(wx.TextDataObject(text))
            wx.TheClipboard.Close()

    def _direct_export_md(self, video_data):
        vid = video_data.get('id') or video_data.get('uuid')
        title = video_data.get('title', 'video')
        from core.export_formatter import ExportFormatter
        safe_name = ExportFormatter.get_safe_filename(title)
        
        with wx.FileDialog(self, "Exportar Markdown", wildcard="Markdown files (*.md)|*.md",
                           defaultFile=f"{safe_name}.md",
                           style=wx.FD_SAVE | wx.FD_OVERWRITE_PROMPT) as fileDialog:
            if fileDialog.ShowModal() == wx.ID_CANCEL:
                return
            path = fileDialog.GetPath()
            from services.export_service import ExportService
            exp = ExportService(self.app_state)
            exp.export_batch([vid], "markdown_single", path)
            wx.MessageBox("Arquivo exportado com sucesso!", "Sucesso", wx.OK)

    def on_grid_click(self, event):
        """Implementação de navegação direta via ícone [MANDATO v5.9]."""
        row, col = event.GetRow(), event.GetCol()
        label = self.col_labels[col].strip()
        
        if label == "[x]":
            val = self.table.GetValue(row, col)
            self.table.SetValue(row, col, "0" if val == "1" else "1")
            self.grid.ForceRefresh()
            return
            
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

    def on_export_batch(self, event):
        """Dispara exportação para itens selecionados via ExportService."""
        ids = list(self.table.selected_ids)
        if not ids:
            wx.MessageBox("Nenhum item selecionado para exportação.", "Aviso", wx.OK | wx.ICON_WARNING)
            return
            
        # Reutiliza lógica de exportação (Poderia usar PubSub ou instanciar Service)
        from services.export_service import ExportService
        exp = ExportService(self.app_state)
        
        with wx.FileDialog(self, "Exportar Selecionados (ZIP)", wildcard="ZIP files (*.zip)|*.zip",
                           style=wx.FD_SAVE | wx.FD_OVERWRITE_PROMPT) as fileDialog:
            if fileDialog.ShowModal() == wx.ID_CANCEL:
                return
            path = fileDialog.GetPath()
            exp.export_batch(ids, "zip", path)
            wx.MessageBox("Exportação concluída!", "Sucesso", wx.OK)
