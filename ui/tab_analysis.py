# contextflow/ui/tab_analysis.py
import wx
import wx.grid
import os
import webbrowser
from core.app_state import AppState
from core.pubsub import PubSub
from core.managers.theme_manager import ThemeManager
from ui.virtual_table import VirtualVideoTable
from ui.components.tag_wrap_panel import TagWrapPanel
from ui.components.analysis_toolbar import AnalysisToolbar
import json

class TabAnalysis(wx.Panel):
    """
    ABA 2: Cockpit Analítico (Master-Detail)
    Foco: Visualização rica, Thumbnails e Análise de Conteúdo.
    Design: Modern/Tailwind (v6.0).
    """
    def __init__(self, parent):
        super().__init__(parent)
        self.app_state = AppState()
        self.theme = ThemeManager()
        self.SetBackgroundColour(self.theme.get_bg_color())
        
        # Colunas Analíticas [Specs 5.9 Expansion]
        self.col_labels = [
            " [x] ", " # ", "Preview", "Título", "Canal", "Duração", 
            "Publicado", "Adicionado", "Playlist", "Tokens", "Tags", "Link", "Resumo"
        ]
        self.table = VirtualVideoTable(col_labels=self.col_labels)
        
        self.debounce_timer = wx.Timer(self)
        self.last_selected_row = -1
        
        # [FASE 6.1b] Estado de IA
        self._ai_models_cache = []      # Cache local de modelos descobertos
        self._summary_in_progress = set()  # video_ids sendo resumidos
        # [FASE 7.2.1] Inicialização da flag anti-loop de eventos
        # Deve ser False por padrão. O padrão try/finally garante que
        # retorna a False mesmo em caso de exceção no SelectRow().
        self._is_programmatic_selection = False
        
        self._init_ui()
        self._bind_events()
        
        # Registro como Observador
        self.app_state.register_observer(self.on_state_mutation)
        
        # Garante refresh inicial
        wx.CallAfter(self._refresh_grid)

    def _init_ui(self):
        main_sizer = wx.BoxSizer(wx.VERTICAL)
        # --- TOOLBAR ANALÍTICA (Fase 6.2: Segregada) ---
        self.toolbar_ctrl = AnalysisToolbar(self, self.app_state)
        main_sizer.Add(self.toolbar_ctrl, 0, wx.EXPAND | wx.BOTTOM, 1)
        
        # --- SPLITTER WINDOW (Master-Detail) ---
        self.splitter = wx.SplitterWindow(self, style=wx.SP_3D | wx.SP_LIVE_UPDATE | wx.SP_NO_XP_THEME)
        self.splitter.SetBackgroundColour(self.theme.get_border_color()) 
        self.splitter.SetSashGravity(0.5) # [MANDATO 5.9] Redimensionamento proporcional
        self.splitter.SetMinimumPaneSize(50) # [REVERSIBILIDADE v5.12] Previne travamento em 0
        
        # MASTER PANEL (Top)
        self.pnl_master = wx.Panel(self.splitter)
        self.pnl_master.SetBackgroundColour(self.theme.get_bg_color())
        master_sizer = wx.BoxSizer(wx.VERTICAL)
        
        self.grid = wx.grid.Grid(self.pnl_master)
        self.grid.SetTable(self.table, takeOwnership=True)
        self.grid.SelectionMode = wx.grid.Grid.GridSelectRows
        
        # Estética HeidiSQL/Modern
        self.grid.SetColLabelSize(32)
        self.grid.SetRowLabelSize(0)
        self.grid.SetDefaultRowSize(52) # Conforto para Preview 80x45
        self.grid.SetGridLineColour(self.theme.get_grid_line())  # [6.2d] era hardcoded
        self.grid.SetCellHighlightPenWidth(0) # Supressão de marquee
        self.grid.SetSelectionBackground(self.theme.get_grid_selection_bg())
        self.grid.SetSelectionForeground(self.theme.get_grid_selection_fg())
        
        # Larguras Fixas
        self.grid.SetColSize(0, 40)   # [x]
        self.grid.SetColSize(1, 40)   # #
        self.grid.SetColSize(2, 90)   # Preview
        self.grid.SetColSize(3, 350)  # Título
        self.grid.SetColSize(4, 120)  # Canal
        self.grid.SetColSize(5, 70)   # Duração
        self.grid.SetColSize(6, 120)  # Publicado
        self.grid.SetColSize(7, 160)  # [QA4] Adicionado (Expansão para evitar corte)
        self.grid.SetColSize(8, 120)  # [QA4] Playlist
        self.grid.SetColSize(9, 80)   # [QA4] Tokens
        self.grid.SetColSize(10, 100) # Tags
        self.grid.SetColSize(11, 40)   # Link
        self.grid.SetColSize(12, 130)  # Resumo (Espaço que era do Status + Resumo anterior)
        
        # [QA2 REFINE] Trava de Layout: Desabilita redimensionamento manual de linhas
        self.grid.DisableDragRowSize()
        
        # [FASE 6.2] Carrega larguras persistidas
        self._load_column_widths()
        
        master_sizer.Add(self.grid, 1, wx.EXPAND)
        self.pnl_master.SetSizer(master_sizer)
        
        # DETAIL PANEL (Bottom)
        self.pnl_detail = wx.Panel(self.splitter)
        self.pnl_detail.SetBackgroundColour(self.theme.get_bg_color()) # Adaptado para Light Mode
        detail_sizer = wx.BoxSizer(wx.HORIZONTAL)
        
        # Lateral com Thumbnail Expandida e Controles
        self.pnl_side_info = wx.Panel(self.pnl_detail, size=(340, -1))
        side_sizer = wx.BoxSizer(wx.VERTICAL)
        
        # [CONTROLE MANUAL] Botão de Fechar Visualizador
        self.btn_close_viewer = wx.Button(self.pnl_side_info, label="✕ Fechar Visualizador", size=(-1, 30))
        self.btn_close_viewer.SetBackgroundColour(self.theme.get_highlight_color())  # [6.2d]
        self.btn_close_viewer.SetForegroundColour(self.theme.get_fg_color())  # [6.2d]
        self.btn_close_viewer.SetFont(wx.Font(9, wx.FONTFAMILY_DEFAULT, wx.FONTSTYLE_NORMAL, wx.FONTWEIGHT_BOLD))
        
        self.bmp_detail = wx.StaticBitmap(self.pnl_side_info, size=(320, 180))
        self.bmp_detail.SetBackgroundColour(wx.BLACK)
        
        self.lbl_side_title = wx.StaticText(self.pnl_side_info, label="Selecione um item")
        self.lbl_side_title.SetFont(wx.Font(11, wx.FONTFAMILY_DEFAULT, wx.FONTSTYLE_NORMAL, wx.FONTWEIGHT_BOLD))
        self.lbl_side_title.SetForegroundColour(self.theme.get_accent_color())
        self.lbl_side_title.Wrap(320)

        # [FASE 6.2] Painel de tags completas
        self.pnl_tags = TagWrapPanel(self.pnl_side_info)

        side_sizer.Add(self.btn_close_viewer, 0, wx.ALL | wx.EXPAND, 5)
        side_sizer.Add(self.bmp_detail, 0, wx.ALL, 10)
        side_sizer.Add(self.lbl_side_title, 0, wx.LEFT | wx.RIGHT | wx.BOTTOM | wx.EXPAND, 10)
        side_sizer.Add(self.pnl_tags, 0, wx.LEFT | wx.RIGHT | wx.BOTTOM | wx.EXPAND, 10)
        self.pnl_side_info.SetSizer(side_sizer)
        
        # Conteúdo Textual
        self.txt_summary = wx.TextCtrl(self.pnl_detail, style=wx.TE_MULTILINE | wx.TE_READONLY | wx.TE_RICH2 | wx.NO_BORDER)
        self.txt_summary.SetBackgroundColour(self.theme.get_bg_color())
        self.txt_summary.SetForegroundColour(self.theme.get_fg_color())
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
        self.btn_close_viewer.Bind(wx.EVT_BUTTON, self.on_close_viewer)
        self.toolbar_ctrl.search.Bind(wx.EVT_TEXT, self.on_search)
        
        # [QA2 REFINE] Atalhos de Teclado
        self.grid.Bind(wx.EVT_KEY_DOWN, self.on_key_down)
        
        # [FUNCIONALIDADE v5.9] Ativação do Botão Exportar
        self.toolbar_ctrl.btn_export.Bind(wx.EVT_BUTTON, self.on_export_batch)
        self.toolbar_ctrl.btn_cancel.Bind(wx.EVT_BUTTON, self.on_cancel_all)
        
        self.grid.Bind(wx.grid.EVT_GRID_LABEL_LEFT_CLICK, self.on_label_click)
        self.Bind(wx.EVT_TIMER, self.on_debounce_tick, self.debounce_timer)
        self.grid.GetGridWindow().Bind(wx.EVT_MOTION, self.on_grid_motion)
        self.grid.Bind(wx.grid.EVT_GRID_CELL_LEFT_CLICK, self.on_grid_click)
        
        # [FASE 6.1b] Bindings de IA
        self.toolbar_ctrl.btn_summarize.Bind(wx.EVT_BUTTON, self._on_batch_summarize)
        self.grid.Bind(wx.grid.EVT_GRID_COL_SIZE, self.on_col_size)

        # [FASE 6.1b] PubSub listeners de IA
        PubSub.subscribe('SUMMARY_STARTED', self._on_summary_started)
        PubSub.subscribe('SUMMARY_COMPLETED', self._on_summary_completed)
        PubSub.subscribe('SUMMARY_ERROR', self._on_summary_error)
        
        # [FASE 6.0] Expansão do Cockpit via Double Click
        self.grid.Bind(wx.grid.EVT_GRID_CELL_LEFT_DCLICK, self.on_grid_dclick)

        # [7.1 PENDÊNCIA 5] Bloqueio de seleção acidental
        self.grid.Bind(wx.grid.EVT_GRID_RANGE_SELECT, self._on_range_select)
        self.grid.Bind(wx.grid.EVT_GRID_SELECT_CELL, self._on_cell_select_row)

    def _load_column_widths(self):
        """[FASE 6.2] Restaura larguras das colunas do ConfigManager."""
        widths = self.app_state.config.get("ui", "column_widths", {}).get("tab_analysis", {})
        if not widths:
            return
        for col_idx, width in widths.items():
            try:
                self.grid.SetColSize(int(col_idx), int(width))
            except:
                continue

    def on_col_size(self, event):
        """[FASE 6.2] Persiste largura da coluna ao redimensionar."""
        col = event.GetRowOrCol()
        width = self.grid.GetColSize(col)
        
        # Salva no ConfigManager
        all_widths = self.app_state.config.get("ui", "column_widths", {})
        if "tab_analysis" not in all_widths:
            all_widths["tab_analysis"] = {}
        
        all_widths["tab_analysis"][str(col)] = width
        self.app_state.config.set("ui", "column_widths", all_widths)
        event.Skip()

    def on_state_mutation(self, event_type, data=None):
        if event_type in ['VIDEO_ADDED', 'VIDEO_UPDATED', 'TASK_COMPLETED', 'DATA_LOADED', 'VIDEOS_DELETED', 'VIDEO_PROMOTED']:
            wx.CallAfter(self.on_data_signal)

    def on_data_signal(self):
        """Debouncing 'Restart-on-Event' [Mandato 5.9]."""
        if self.debounce_timer.IsRunning():
            self.debounce_timer.Stop()
        self.debounce_timer.Start(250, oneShot=True)

    def on_debounce_tick(self, event):
        self._refresh_grid()

    def _refresh_grid(self):
        query = self.toolbar_ctrl.search.GetValue().lower()
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
        # [ORDENAÇÃO v6.1] Mapeamento de label para chave do dado
        mapping = {
            'Título': 'title',
            'Canal': 'channel_name',
            'Duração': 'duration',
            'Status': 'status',
            'Publicado': 'upload_date',
            'Adicionado': 'added_at',
            'Link': 'url',
            'Tags': 'tags',
            'Resumo': 'transcript_snippet',
            'Playlist': 'playlist_title',
            'Tokens': 'token_count'
        }
        key = mapping.get(label)
        if key:
            # [QA3] Tratamento de datas e números para ordenação natural
            def sort_val(x):
                val = x.get(key, "")
                if key == 'token_count':
                    try: return int(val or 0)
                    except: return 0
                if key == 'added_at':
                    # Converte DD/MM/YYYY HH:MM:SS para YYYYMMDDHHMMSS
                    ts = str(val)
                    if len(ts) >= 10 and ts[2] == '/' and ts[5] == '/':
                        return ts[6:10] + ts[3:5] + ts[0:2] + ts[11:]
                return str(val).lower()

            self.table.data.sort(key=sort_val, reverse=not self.table.sort_ascending)
            self.grid.ForceRefresh()

    def on_grid_motion(self, event):
        """
        [7.1 PENDÊNCIA 3 + original] Cursor hand em colunas interativas.
        Colunas interativas: Link, Resumo (CTA), Preview (thumbnail).
        """
        pos = event.GetPosition()
        # Converte posição para coordenadas da grid (com scroll)
        unscrolled = self.grid.CalcUnscrolledPosition(pos)
        coords = self.grid.XYToCell(unscrolled.x, unscrolled.y)
        col = coords.GetCol()

        INTERACTIVE_COLS = {"Link", "Resumo", "Preview"}

        if col >= 0 and col < len(self.col_labels):
            label = self.col_labels[col].strip()
            if label in INTERACTIVE_COLS:
                # Verifica se é CTA ativo (não "summarizing")
                if label == "Resumo":
                    row = coords.GetRow()
                    if 0 <= row < len(self.table.data):
                        ss = self.table.data[row].get('summary_status', '')
                        if ss == 'summarizing':
                            # Em progresso: cursor padrão
                            self.grid.GetGridWindow().SetCursor(
                                wx.Cursor(wx.CURSOR_ARROW)
                            )
                            event.Skip()
                            return
                self.grid.GetGridWindow().SetCursor(
                    wx.Cursor(wx.CURSOR_HAND)
                )
                event.Skip()
                return

        self.grid.GetGridWindow().SetCursor(wx.Cursor(wx.CURSOR_ARROW))
        event.Skip()

    def on_right_click(self, event):
        row, col = event.GetRow(), event.GetCol()
        if row < 0 or row >= len(self.table.data): return
        
        # [PHASE_5_11] Targeted Selection: Foca a linha mas não altera checkbox
        self.grid.SetGridCursor(row, col)
        video_data = self.table.data[row]
        vid = video_data.get('id') or video_data.get('uuid')
        title = video_data.get('title', 'Vídeo sem título')
        
        menu = wx.Menu()
        m_del = menu.Append(wx.ID_ANY, "🗑️ Excluir")
        m_link = menu.Append(wx.ID_ANY, "🔗 Abrir Link")
        m_copy = menu.Append(wx.ID_ANY, "📋 Copiar Link")
        m_md = menu.Append(wx.ID_ANY, "📄 Baixar como MD")
        m_read = menu.Append(wx.ID_ANY, "📖 Ler (Aba 3)")
        m_sum = menu.Append(wx.ID_ANY, "✨ Resumir")
        
        # [PHASE_5_11] Targeted Delete Protocol
        def on_del(e):
            msg = f"Deseja excluir permanentemente o vídeo:\n'{title}'?"
            if wx.MessageBox(msg, "Confirmar Exclusão", wx.YES_NO | wx.ICON_QUESTION) == wx.YES:
                self.app_state.delete_videos([vid])

        self.Bind(wx.EVT_MENU, on_del, m_del)
        self.Bind(wx.EVT_MENU, lambda e: webbrowser.open(video_data.get('url')), m_link)
        self.Bind(wx.EVT_MENU, lambda e: self._copy_to_clipboard(video_data.get('url')), m_copy)
        self.Bind(wx.EVT_MENU, lambda e: self._direct_export_md(video_data), m_md)
        self.Bind(wx.EVT_MENU, lambda e: PubSub.publish('REQUEST_VIEW_VIDEO', video_id=vid), m_read)
        def on_summarize(e):
            if not vid:
                return
            video = self.app_state.get_video(vid)
            if not video:
                return
            ss = video.get("summary_status")
            if ss == "summarizing":
                wx.MessageBox("Este vídeo já está sendo resumido.", "Info",
                               wx.OK | wx.ICON_INFORMATION)
                return
            if ss == "summarized":
                if wx.MessageBox(
                    "Este vídeo já possui resumo. Deseja gerar novamente?",
                    "Confirmação", wx.YES_NO | wx.ICON_QUESTION
                ) != wx.YES:
                    return
                # Reseta status para permitir re-resumo
                self.app_state.add_or_update_video({
                    "id": vid, "summary_status": None
                })

            self.app_state.request_summary(vid)

        self.Bind(wx.EVT_MENU, on_summarize, m_sum)
        
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
            return

        # [7.1 — PENDÊNCIA 1] Expansão de thumbnail na coluna Preview
        if label == "Preview":
            if row >= 0 and row < len(self.table.data):
                video_data = self.table.data[row]
                thumb_path = video_data.get('thumbnail_path', '')
                if thumb_path and os.path.exists(thumb_path):
                    self._show_thumbnail_dialog(thumb_path)
            event.Skip()
            return

        # [FASE 6.2] Coluna Resumo clicável — dispara ação de resumir
        if label == "Resumo":
            if row < 0 or row >= len(self.table.data):
                event.Skip()
                return
            video_data = self.table.data[row]
            vid = video_data.get('id') or video_data.get('uuid')
            if not vid:
                event.Skip()
                return
            video = self.app_state.get_video(vid)
            if not video:
                event.Skip()
                return
            ss = video.get("summary_status", "")
            if ss == "summarizing":
                # Já em progresso, não faz nada
                event.Skip()
                return
            if ss == "summarized":
                # Já tem resumo — abre o viewer
                self._load_row_details(row)
                if not self.splitter.IsSplit():
                    h = self.GetSize().height
                    self.splitter.SplitHorizontally(
                        self.pnl_master, self.pnl_detail, int(h * 0.3)
                    )
                event.Skip()
                return
            # Pendente ou erro — dispara resumo
            if video.get("status") != "completed":
                wx.MessageBox(
                    "Este vídeo ainda não possui transcrição.\nBaixe o vídeo primeiro.",
                    "Aviso", wx.OK | wx.ICON_WARNING)
                event.Skip()
                return
            if ss == "summary_error":
                self.app_state.add_or_update_video({"id": vid, "summary_status": None})
            self.app_state.request_summary(vid)
            event.Skip()
            return

        event.Skip()

    def on_grid_dclick(self, event):
        """
        [FASE 6.1b] Duplo clique:
        - Se auto_open_viewer desativado: toggle do painel
        - Se auto_open_viewer ativado: já abre por seleção, dclick fecha
        """
        row = event.GetRow()
        if row < 0 or row >= len(self.table.data):
            event.Skip()
            return

        if self.splitter.IsSplit():
            # Fecha o painel
            self.splitter.Unsplit(self.pnl_detail)
        else:
            # Abre o painel e carrega detalhes
            self._load_row_details(row)
            if not self.splitter.IsSplit():
                h = self.GetSize().height
                self.splitter.SplitHorizontally(
                    self.pnl_master, self.pnl_detail, int(h * 0.3)
                )

        event.Skip()

    def on_select_video(self, event):
        """
        [FASE 6.1b] Seleção simples:
        - Se auto_open_viewer ativo: carrega detalhes e abre painel (se tem resumo)
        - Se desativado: apenas atualiza seleção interna (duplo clique para abrir)
        """
        row = event.GetRow()
        auto_open = self.app_state.config.get("ui", "auto_open_viewer", True)

        if auto_open:
            self._load_row_details(row)
        else:
            # Só registra a seleção, sem abrir painel
            self.last_selected_row = row

        event.Skip()

    def _load_row_details(self, row):
        """[QA3] Lógica centralizada de carregamento de detalhes."""
        # [QA3] Removida trava de row != last_selected_row para permitir reabertura imediata
        if row >= 0 and row < len(self.table.data):
            self.last_selected_row = row
            video_data = self.table.data[row]
            vid_id = video_data.get('id')
            
            # Atualiza UI de Detalhe
            self.lbl_side_title.SetLabel(video_data.get('title', 'Unknown'))
            self.lbl_side_title.Wrap(320) # Re-wrap após mudar o texto

            # ─── [FASE 6.2] Tags completas ───────────────────
            raw_tags = video_data.get("tags", "[]")
            tags = []
            if isinstance(raw_tags, str):
                try:
                    tags = json.loads(raw_tags)
                except (json.JSONDecodeError, TypeError):
                    tags = []
            elif isinstance(raw_tags, list):
                tags = raw_tags
            self.pnl_tags.set_tags(tags)
            
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

            # [FASE 6.1b] Carregamento condicional de conteúdo
            summary_status = video_data.get("summary_status", "")
            t_data = self.app_state.db_handler.get_transcript(vid_id)
            has_summary = False

            if summary_status == "summarized" and t_data:
                summary_text = t_data.get("summary", "")
                if summary_text:
                    self.txt_summary.SetValue(summary_text)
                    has_summary = True

            if summary_status == "summarizing":
                self.txt_summary.SetValue("⏳ Resumo em processamento...\n\n"
                                          "Aguarde a conclusão da análise por IA.")
                has_summary = True  # Mostra o painel para feedback

            if summary_status == "summary_error":
                self.txt_summary.SetValue("❌ Ocorreu um erro ao gerar o resumo.\n\n"
                                          "Tente novamente pelo menu de contexto → Resumir.")

            if not has_summary and not summary_status:
                tr_text = t_data.get('full_text', '') if t_data else ''
                if tr_text:
                    self.txt_summary.SetValue(tr_text)
                else:
                    self.txt_summary.SetValue(
                        "Este vídeo ainda não foi resumido.\n\n"
                        "Para gerar o resumo:\n"
                        "  • Clique direito → ✨ Resumir\n"
                        "  • Ou selecione e clique '✨ Resumir Selecionados' na toolbar"
                    )

            # [FASE 6.1b] Visualizador condicional
            # Painel inferior SÓ abre automaticamente se há resumo concluído ou em progresso
            if has_summary or summary_status == "summarizing":
                auto_open = self.app_state.config.get("ui", "auto_open_viewer", True)
                if auto_open and not self.splitter.IsSplit():
                    self.splitter.SplitHorizontally(
                        self.pnl_master, self.pnl_detail, -300
                    )

    def on_close_viewer(self, event):
        """[QA3] Fecha o visualizador e reseta seleção lógica."""
        self.splitter.Unsplit(self.pnl_detail)
        self.last_selected_row = -1 # Permite re-seleção imediata para reabrir

    def on_key_down(self, event):
        """[PHASE_5_11] Atalhos: Espaço (Blue-to-Check) e Delete (Exclusão Massiva)."""
        key = event.GetKeyCode()
        
        if key == wx.WXK_SPACE:
            rows = self.grid.GetSelectedRows()
            if not rows:
                # Fallback: alterna apenas a linha sob o cursor
                row = self.grid.GetGridCursorRow()
                if row >= 0: rows = [row]
            
            if rows:
                # [PHASE_5_11] Algoritmo de Inversão de Bloco
                # Na Aba 2, o checkbox está na coluna 0
                master_val = self.table.GetValue(rows[0], 0)
                new_val = "0" if master_val == "1" else "1"
                for r in rows:
                    self.table.SetValue(r, 0, new_val)
                self.grid.ForceRefresh()
                
        elif key == wx.WXK_DELETE:
            self.on_delete_selected(None)
        else:
            event.Skip()

    def on_delete_selected(self, event):
        """Implementação consistente de deleção massiva com confirmação segura."""
        ids = list(self.table.selected_ids)
        if not ids:
            wx.MessageBox("Nenhum item selecionado via checkbox.", "Aviso", wx.OK | wx.ICON_WARNING)
            return
            
        msg = f"Deseja excluir permanentemente os {len(ids)} vídeos selecionados?"
        if wx.MessageBox(msg, "Confirmar Exclusão Massiva", wx.YES_NO | wx.ICON_QUESTION) == wx.YES:
            self.app_state.delete_videos(ids)
            self.table.selected_ids.clear()
            self._refresh_grid()

    def on_export_batch(self, event):
        """Dispara exportação para itens selecionados via ExportService (Threaded)."""
        ids = list(self.table.selected_ids)
        if not ids:
            wx.MessageBox("Nenhum item selecionado para exportação.", "Aviso", wx.OK | wx.ICON_WARNING)
            return
            
        with wx.FileDialog(self, "Exportar Selecionados (ZIP)", wildcard="ZIP files (*.zip)|*.zip",
                           style=wx.FD_SAVE | wx.FD_OVERWRITE_PROMPT) as fileDialog:
            if fileDialog.ShowModal() == wx.ID_CANCEL:
                return
            path = fileDialog.GetPath()
            
            # [QA3] Exportação assíncrona para não travar a UI em lotes massivos
            pd = wx.ProgressDialog("Exportando...", "Iniciando...", maximum=len(ids), parent=self, 
                                   style=wx.PD_APP_MODAL | wx.PD_AUTO_HIDE)
            
            def update_progress(current, total, msg):
                if pd:
                    wx.CallAfter(pd.Update, current, msg)
                    if current >= total:
                        wx.CallAfter(wx.MessageBox, "Exportação concluída!", "Sucesso", wx.OK)
            
            from services.export_service import ExportService
            exp = ExportService(self.app_state)
            
            import threading
            t = threading.Thread(target=exp.export_batch, args=(ids, "zip", path, update_progress), daemon=True)
            t.start()


    def on_cancel_all(self, event):
        """Dispara sinal de cancelamento global."""
        if wx.MessageBox("Deseja cancelar todas as tarefas pendentes?", "Confirmação", wx.YES_NO | wx.ICON_QUESTION) == wx.YES:
            PubSub.publish('REQUEST_CANCEL_ALL')
            wx.MessageBox("Comando de cancelamento enviado.", "Info", wx.OK)

    # ═══════════════════════════════════════════════════════════
    # FASE 6.1b — CONTROLES DE IA
    # ═══════════════════════════════════════════════════════════



    def _on_batch_summarize(self, event):
        ids = list(self.table.selected_ids)
        if not ids:
            wx.MessageBox(
                "Nenhum vídeo selecionado.\n\n"
                "Selecione vídeos via checkbox antes de resumir.",
                "Aviso", wx.OK | wx.ICON_WARNING
            )
            return

        eligible = []
        already_done = 0
        no_transcript = 0

        for vid in ids:
            video = self.app_state.get_video(vid)
            if not video:
                continue
            ss = video.get("summary_status")
            status = video.get("status", "")
            if ss == "summarized":
                already_done += 1
                continue
            if ss == "summarizing":
                continue
            if status != "completed":
                no_transcript += 1
                continue
            eligible.append(vid)

        if not eligible:
            msg = "Nenhum vídeo elegível para resumo."
            if already_done > 0:
                msg += f"\n• {already_done} já resumido(s)"
            if no_transcript > 0:
                msg += f"\n• {no_transcript} sem transcrição (baixe primeiro)"
            wx.MessageBox(msg, "Aviso", wx.OK | wx.ICON_INFORMATION)
            return

        # Usa toolbar_ctrl para pegar modelo e provedor
        model = self.toolbar_ctrl.choice_model.GetStringSelection()
        provider = self.toolbar_ctrl.choice_provider.GetStringSelection()
        msg = (
            f"Resumir {len(eligible)} vídeo(s) usando:\n\n"
            f"  Modelo: {model}\n"
            f"  Provedor: {provider}\n\n"
            f"Deseja continuar?"
        )
        if already_done > 0:
            msg += f"\n\n({already_done} vídeo(s) já resumido(s) serão ignorados)"

        if wx.MessageBox(msg, "Confirmar Resumo em Lote",
                         wx.YES_NO | wx.ICON_QUESTION) != wx.YES:
            return

        self.app_state.request_batch_summary(eligible)

    # ═══════════════════════════════════════════════════════════
    # FASE 6.1b — PUBSUB HANDLERS (IA)
    # ═══════════════════════════════════════════════════════════

    def _on_summary_started(self, video_id, **kwargs):
        """
        Handler para SUMMARY_STARTED.
        [THREAD SAFETY] Chamado da thread do AIExecutor → wx.CallAfter obrigatório.
        """
        def _update():
            self._summary_in_progress.add(video_id)
            self._refresh_grid()
        wx.CallAfter(_update)

    def apply_theme(self):
        """[FASE 6.2c] Atualiza cores e refresca a grade analítica."""
        self.theme = ThemeManager()
        bg = self.theme.get_bg_color()
        fg = self.theme.get_fg_color()

        self.SetBackgroundColour(bg)

        # Toolbar
        if hasattr(self, 'toolbar_ctrl'):
            self.toolbar_ctrl.apply_theme()

        # Grid
        if hasattr(self, 'grid'):
            self.theme.apply_grid_theme(self.grid)

        # [6.2c] Painéis estruturais via getattr seguro
        for attr_name in ['pnl_master', 'pnl_detail', 'pnl_side_info']:
            panel = getattr(self, attr_name, None)
            if panel:
                try:
                    panel.SetBackgroundColour(bg)
                except Exception:
                    pass

        # Labels — BG + FG
        if hasattr(self, 'lbl_side_title'):
            self.lbl_side_title.SetBackgroundColour(bg)
            self.lbl_side_title.SetForegroundColour(self.theme.get_accent_color())

        # TagWrapPanel
        if hasattr(self, 'pnl_tags'):
            self.pnl_tags.apply_theme()

        # TextCtrl do resumo
        if hasattr(self, 'txt_summary'):
            self.txt_summary.SetBackgroundColour(bg)
            self.txt_summary.SetForegroundColour(fg)

        # Splitter
        if hasattr(self, 'splitter'):
            self.splitter.SetBackgroundColour(self.theme.get_border_color())

        # Botão fechar viewer
        if hasattr(self, 'btn_close_viewer'):
            self.btn_close_viewer.SetBackgroundColour(self.theme.get_highlight_color())
            self.btn_close_viewer.SetForegroundColour(fg)

        # [6.2c] StaticBitmap (bmp_detail) — fundo escuro intencional
        if hasattr(self, 'bmp_detail'):
            self.bmp_detail.SetBackgroundColour(wx.BLACK)

        self.Refresh()

    def _on_summary_completed(self, video_id, summary_preview="", tags=None, **kwargs):
        """
        Handler para SUMMARY_COMPLETED.
        [THREAD SAFETY] Chamado da thread do AIExecutor → wx.CallAfter obrigatório.
        """
        def _update():
            self._summary_in_progress.discard(video_id)
            self._refresh_grid()
            self._maybe_open_viewer(video_id)
        wx.CallAfter(_update)

    def _on_summary_error(self, video_id, error_msg="", **kwargs):
        """
        Handler para SUMMARY_ERROR.
        [THREAD SAFETY] Chamado da thread do AIExecutor → wx.CallAfter obrigatório.
        """
        def _update():
            self._summary_in_progress.discard(video_id)
            self._refresh_grid()
        wx.CallAfter(_update)

    def _on_range_select(self, event):
        """
        [FASE 7.3b — Aba 2] Supressão de Marquee.
        Bloqueia o comportamento nativo de seleção de área para evitar o
        desenho do retângulo de foco pontilhado sobre as colunas customizadas.
        """
        if getattr(self, '_is_programmatic_selection', False):
            event.Skip()
            return

        self._is_programmatic_selection = True
        try:
            if event.Selecting():
                top_row = event.GetTopRow()
                bottom_row = event.GetBottomRow()
                
                # Força a seleção de linhas inteiras
                # CRÍTICO: ClearSelection + SelectRow em loop suprime o indicador
                # de foco individual (marquee) nas células interativas.
                self.grid.ClearSelection()
                for row in range(top_row, bottom_row + 1):
                    self.grid.SelectRow(row, addToSelected=True)
                
                self.grid.ForceRefresh()
        finally:
            self._is_programmatic_selection = False
        
        event.Skip()

    def _on_cell_select_row(self, event):
        """
        [FASE 7.2.1 — Aba 2] Força seleção de linha inteira ao navegar.

        Na Aba 2, NÃO há guarda por coluna (diferente da Aba 1).
        O checkbox da Aba 2 está na coluna 0 ([x]), mas o handler
        on_grid_click já intercepta o clique antes que este evento
        propague, pois não chama event.Skip() no toggle.

        A flag _is_programmatic_selection (inicializada em __init__)
        previne loops: SelectRow() dispara novamente EVT_GRID_SELECT_CELL,
        que seria capturado por este mesmo handler sem a flag.
        """
        if self._is_programmatic_selection:
            event.Skip()
            return

        row = event.GetRow()
        if row >= 0:
            self._is_programmatic_selection = True
            try:
                self.grid.ClearSelection()
                self.grid.SelectRow(row)
                self.grid.ForceRefresh()
            finally:
                self._is_programmatic_selection = False

        # CRÍTICO: event.Skip() deve vir APÓS o SelectRow para garantir
        # que on_select_video (handler seguinte na cadeia) receba o evento
        # com a linha já corretamente selecionada.
        event.Skip()

    def _show_thumbnail_dialog(self, thumb_path: str):
        """[7.1.1] Abre thumbnail em dialog modal ampliado."""
        img = wx.Image(thumb_path, wx.BITMAP_TYPE_ANY)
        if not img.IsOk():
            return

        display_w, display_h = wx.GetDisplaySize()
        max_w = int(display_w * 0.8)
        max_h = int(display_h * 0.8)
        img_w, img_h = img.GetWidth(), img.GetHeight()
        scale = min(max_w / max(img_w, 1), max_h / max(img_h, 1), 1.0)
        new_w, new_h = int(img_w * scale), int(img_h * scale)
        img = img.Scale(new_w, new_h, wx.IMAGE_QUALITY_HIGH)

        dlg = wx.Dialog(
            self, title="Prévia da Thumbnail",
            style=wx.DEFAULT_DIALOG_STYLE | wx.RESIZE_BORDER
        )
        dlg.SetBackgroundColour(wx.BLACK)
        bmp_btn = wx.BitmapButton(
            dlg, wx.ID_ANY, wx.Bitmap(img), style=wx.BORDER_NONE
        )
        bmp_btn.SetBackgroundColour(wx.BLACK)
        sizer = wx.BoxSizer(wx.VERTICAL)
        sizer.Add(bmp_btn, 1, wx.ALL | wx.CENTER, 0)
        dlg.SetSizer(sizer)
        dlg.Fit()
        dlg.CenterOnParent()
        bmp_btn.Bind(wx.EVT_BUTTON, lambda e: dlg.Close())
        dlg.Bind(
            wx.EVT_CHAR_HOOK,
            lambda e: dlg.Close() if e.GetKeyCode() == wx.WXK_ESCAPE else e.Skip()
        )
        dlg.ShowModal()
        dlg.Destroy()
    def _maybe_open_viewer(self, video_id):
        """
        Abre o painel de detalhe SE:
        1. A opção 'auto_open_viewer' está ativa no ConfigManager
        2. O vídeo tem resumo (summary_status == 'summarized')
        3. O vídeo é o atualmente selecionado na grid
        """
        auto_open = self.app_state.config.get("ui", "auto_open_viewer", True)
        if not auto_open:
            return

        # Verifica se o vídeo completado está selecionado
        if self.last_selected_row >= 0 and self.last_selected_row < len(self.table.data):
            current_data = self.table.data[self.last_selected_row]
            current_id = current_data.get("id")
            if current_id == video_id:
                self._load_row_details(self.last_selected_row)
