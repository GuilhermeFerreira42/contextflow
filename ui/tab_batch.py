# contextflow/ui/tab_batch.py
import wx
import wx.grid
import os
import webbrowser
from core.pubsub import PubSub
from core.app_state import AppState
from core.managers.theme_manager import ThemeManager
from ui.virtual_table import VirtualVideoTable
from services.export_service import ExportService

# [ZERO KNOWLEDGE] Esta aba é isolada e não deve importar outras abas ou painéis de detalhe.
class TabBatch(wx.Panel):
    """
    ABA 1: Doca de Carga (Batch Ingestion)
    Dedicada à entrada massiva de URLs e gestão de lote.
    Padrão: HeidiSQL / Técnico de Alta Densidade.
    """
    def __init__(self, parent):
        super().__init__(parent)
        self.app_state = AppState()
        self.theme = ThemeManager()
        self.export_service = ExportService(self.app_state)
        self.table = VirtualVideoTable()
        self.SetBackgroundColour(self.theme.get_bg_color())
        
        self.debounce_timer = wx.Timer(self)
        
        self._init_ui()
        self._bind_events()
        
        # [SSOT] Registro como Observador Oficial do Estado
        self.app_state.register_observer(self.on_state_mutation)
        
        self._refresh_grid()

    def _init_ui(self):
        # ... (layout code remains same)
        main_sizer = wx.BoxSizer(wx.VERTICAL)
        # --- SEÇÃO 1: INGESTÃO (TOP) ---
        input_box = wx.StaticBox(self, label=" Adicionar URLs ")
        input_sizer = wx.StaticBoxSizer(input_box, wx.VERTICAL)
        
        self.txt_input = wx.TextCtrl(self, style=wx.TE_MULTILINE, size=(-1, 80))
        self.txt_input.SetHint("Cole as URLs aqui (uma por linha)...")
        input_sizer.Add(self.txt_input, 1, wx.EXPAND | wx.ALL, 5)
        
        btn_sizer = wx.BoxSizer(wx.HORIZONTAL)
        self.btn_clear = wx.Button(self, label="Limpar Lista")
        
        # [PROCEDIMENTO DE COOLDOWN] Botão de reset rápido para erros 429
        self.btn_reset_safety = wx.Button(self, label="Reset Safety")
        self.btn_reset_safety.SetForegroundColour(wx.Colour(200, 50, 50))
        
        self.btn_process = wx.Button(self, label="PROCESSAR FILA")
        self.btn_process.SetBackgroundColour(self.theme.get_accent_color())
        self.btn_process.SetForegroundColour(wx.WHITE)
        
        btn_sizer.Add(self.btn_clear, 0, wx.RIGHT, 5)
        btn_sizer.Add(self.btn_reset_safety, 0, wx.RIGHT, 5)
        btn_sizer.Add(self.btn_process, 0)
        input_sizer.Add(btn_sizer, 0, wx.ALIGN_RIGHT | wx.BOTTOM | wx.RIGHT, 5)
        
        # [QA4] Barra de Esforço (Loading Gauge)
        self.gauge = wx.Gauge(self, range=100, style=wx.GA_HORIZONTAL)
        self.gauge.Hide() # Oculto por padrão
        input_sizer.Add(self.gauge, 0, wx.EXPAND | wx.LEFT | wx.RIGHT | wx.BOTTOM, 5)
        
        main_sizer.Add(input_sizer, 0, wx.EXPAND | wx.ALL, 10)

        # --- SEÇÃO 2: GRADE TÉCNICA (CENTER) ---
        grid_sizer = wx.BoxSizer(wx.VERTICAL)
        lbl_grid = wx.StaticText(self, label="Lista de Processamento:")
        grid_sizer.Add(lbl_grid, 0, wx.LEFT | wx.BOTTOM, 5)
        
        self.grid = wx.grid.Grid(self)
        self.grid.SetTable(self.table, takeOwnership=True)
        self.grid.SelectionMode = wx.grid.Grid.GridSelectRows
        
        # Configuração Estética HeidiSQL (Light Mode)
        self.grid.SetColLabelSize(25)
        self.grid.SetRowLabelSize(0)
        self.grid.EnableGridLines(True)
        self.grid.SetGridLineColour(self.theme.get_border_color()) # Cinza claro para contraste no branco
        
        # [AFFORDANCE] Define larguras conforme SSoT de Usabilidade
        self.grid.SetColSize(0, 40)   # #
        self.grid.SetColSize(1, 40)   # [x]
        self.grid.SetColSize(2, 40)   # Link (Mandato 5.9: 40px)
        self.grid.SetColSize(3, 400)  # Título
        self.grid.SetColSize(4, 150)  # Canal
        self.grid.SetColSize(5, 80)   # Duração
        self.grid.SetColSize(6, 160)  # [QA4] Adicionado (Expansão para evitar corte)
        self.grid.SetColSize(7, 120)  # Playlist
        self.grid.SetColSize(8, 80)   # Tokens
        self.grid.SetColSize(10, 100) # Status
        
        # [QA2 REFINE] Trava de Layout: Desabilita redimensionamento manual de linhas
        self.grid.DisableDragRowSize()
        
        # [FASE 6.2] Carrega larguras persistidas
        self._load_column_widths()
        
        grid_sizer.Add(self.grid, 1, wx.EXPAND | wx.LEFT | wx.RIGHT, 10)
        main_sizer.Add(grid_sizer, 1, wx.EXPAND)

        # --- SEÇÃO 3: BARRA DE AÇÕES (FOOTER) ---
        action_sizer = wx.BoxSizer(wx.HORIZONTAL)
        self.btn_delete = wx.Button(self, label="Excluir Selecionados")
        self.btn_unify = wx.Button(self, label="Unificar (.md)")
        self.btn_download_md = wx.Button(self, label="Baixar como MD")
        self.btn_export_zip = wx.Button(self, label="Exportar (ZIP)")
        self.btn_cancel = wx.Button(self, label="🛑 CANCELAR")
        self.btn_cancel.SetForegroundColour(wx.Colour(200, 50, 50))
        
        action_sizer.Add(self.btn_delete, 0, wx.RIGHT, 5)
        action_sizer.Add(self.btn_unify, 0, wx.RIGHT, 5)
        action_sizer.Add(self.btn_download_md, 0, wx.RIGHT, 5)
        action_sizer.Add(self.btn_export_zip, 0, wx.RIGHT, 5)
        action_sizer.Add(self.btn_cancel, 0)
        
        main_sizer.Add(action_sizer, 0, wx.ALL | wx.ALIGN_LEFT, 10)
        self.SetSizer(main_sizer)

    def _bind_events(self):
        self.btn_process.Bind(wx.EVT_BUTTON, self.on_click_process)
        self.btn_reset_safety.Bind(wx.EVT_BUTTON, self.on_reset_safety)
        self.btn_clear.Bind(wx.EVT_BUTTON, lambda e: self.txt_input.Clear())
        self.btn_delete.Bind(wx.EVT_BUTTON, self.on_delete_selected)
        self.btn_unify.Bind(wx.EVT_BUTTON, self.on_unify_md)
        self.btn_download_md.Bind(wx.EVT_BUTTON, self.on_download_md)
        self.btn_export_zip.Bind(wx.EVT_BUTTON, self.on_export_zip)
        self.btn_cancel.Bind(wx.EVT_BUTTON, self.on_cancel_all)
        self.Bind(wx.EVT_TIMER, self.on_debounce_tick, self.debounce_timer)
        
        # [USABILIDADE] Eventos de Grade de Baixa Latência
        self.grid.Bind(wx.grid.EVT_GRID_CELL_LEFT_CLICK, self.on_grid_click)
        self.grid.Bind(wx.grid.EVT_GRID_LABEL_LEFT_CLICK, self.on_label_click)
        self.grid.Bind(wx.grid.EVT_GRID_CELL_RIGHT_CLICK, self.on_right_click)
        self.grid.GetGridWindow().Bind(wx.EVT_MOTION, self.on_grid_motion)
        self.grid.Bind(wx.grid.EVT_GRID_COL_SIZE, self.on_col_size)
        
        # [QA2 REFINE] Atalhos de Teclado
        self.grid.Bind(wx.EVT_KEY_DOWN, self.on_key_down)

    def _load_column_widths(self):
        """[FASE 6.2] Restaura larguras das colunas do ConfigManager."""
        widths = self.app_state.config.get("ui", "column_widths", {}).get("tab_batch", {})
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
        if "tab_batch" not in all_widths:
            all_widths["tab_batch"] = {}
        
        all_widths["tab_batch"][str(col)] = width
        self.app_state.config.set("ui", "column_widths", all_widths)
        event.Skip()
        
        # [QA4] Escuta progresso global
        PubSub.subscribe('METADATA_FETCHED', self.on_progress_signal)
        PubSub.subscribe('TASK_COMPLETED', self.on_progress_signal)
        PubSub.subscribe('TASK_ERROR', self.on_progress_signal)
        PubSub.subscribe('TASKS_CLEARED', self.on_progress_signal)
        PubSub.subscribe('ALL_TASKS_STOPPED', self.on_progress_signal)

    def on_grid_click(self, event):
        """
        [HITBOX EXPANDIDA & GATILHO IMEDIATO]
        Intercepa o clique na coluna 1 antes da seleção de linha do wxPython.
        """
        row, col = event.GetRow(), event.GetCol()
        if col == 1: # TOGGLE CHECKBOX (One-Click)
            val = self.table.GetValue(row, col)
            self.table.SetValue(row, col, "0" if val == "1" else "1")
            self.grid.ForceRefresh()
            # [CRÍTICO] Não chama Event.Skip() para impedir que SelectRows capture o clique
            return 
            
        elif col == 2: # OPEN LINK (Navigation)
            url = self.table.GetValue(row, col)
            if url and url.startswith("http"):
                webbrowser.open(url)
        event.Skip()

    def on_label_click(self, event):
        if event.GetCol() == 1: # SELEÇÃO GLOBAL (Check/Uncheck All)
            if not self.table.data: return
            
            # [SSOT v5.8] Usa a própria lógica híbrida da tabela para ler o estado
            is_first_selected = (self.table.GetValue(0, 1) == "1")
            
            new_selection = set()
            if not is_first_selected:
                # Marcar todos
                for item in self.table.data:
                    vid = item.get('uuid') or item.get('id')
                    if vid: new_selection.add(vid)
            
            self.table.selected_ids = new_selection
            self.grid.ForceRefresh()
            return

        # [ORDENAÇÃO v5.9]
        col = event.GetCol()
        if col >= 0:
            self._sort_grid(col)
        event.Skip()

    def _sort_grid(self, col):
        if not self.table.data: return
        
        # Toggle ascending/descending
        if self.table.sort_col == col:
            self.table.sort_ascending = not self.table.sort_ascending
        else:
            self.table.sort_col = col
            self.table.sort_ascending = True

        label = self.table.col_labels[col].strip()
        
        # Mapeamento de label para chave do dado
        mapping = {
            'Link': 'url',
            'Título': 'title',
            'Canal': 'channel_name',
            'Duração': 'duration',
            'Publicado': 'upload_date',
            'Adicionado': 'added_at',
            'Playlist': 'playlist_title',
            'Tokens': 'token_count',
            'Status': 'status'
        }
        
        key = mapping.get(label, None)
        if label == "#": 
             # No-op or sort by original order if we had one
             return

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
            # self.app_state.notify_user("Link copiado!") # Opcional: feedback visual via StatusBar ou Toast

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
            
            # [QA3] Exportação assíncrona mesmo para arquivo único (Consistência)
            pd = wx.ProgressDialog("Exportando...", "Gravando arquivo...", maximum=1, parent=self, 
                                   style=wx.PD_APP_MODAL | wx.PD_AUTO_HIDE)
            
            def update_progress(current, total, msg):
                if pd:
                    wx.CallAfter(pd.Update, current, msg)
                    if current >= total:
                        wx.CallAfter(wx.MessageBox, "Arquivo exportado com sucesso!", "Sucesso", wx.OK)
            
            import threading
            t = threading.Thread(target=self.export_service.export_batch, args=([vid], "markdown_single", path, update_progress), daemon=True)
            t.start()

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
                master_val = self.table.GetValue(rows[0], 1)
                new_val = "0" if master_val == "1" else "1"
                for r in rows:
                    self.table.SetValue(r, 1, new_val)
                self.grid.ForceRefresh()
                
        elif key == wx.WXK_DELETE:
            self.on_delete_selected(None)
        else:
            event.Skip()

    def on_grid_motion(self, event):
        """Muda o cursor sobre o Link para Hand Affordance."""
        pos = event.GetPosition()
        row, col = self.grid.XYToCell(self.grid.CalcUnscrolledPosition(pos).x, 
                                     self.grid.CalcUnscrolledPosition(pos).y)
        if col == 2:
            self.grid.GetGridWindow().SetCursor(wx.Cursor(wx.CURSOR_HAND))
        else:
            self.grid.GetGridWindow().SetCursor(wx.Cursor(wx.CURSOR_ARROW))
        event.Skip()

    def on_state_mutation(self, event_type, data=None):
        """Callback do AppState Observer (Garante [THREAD SAFETY])."""
        wx.CallAfter(self.on_data_signal)

    def on_data_signal(self, **kwargs):
        """Debouncing de 250ms para evitar flickering na Grid."""
        if self.debounce_timer.IsRunning():
            self.debounce_timer.Stop()
        self.debounce_timer.Start(250, oneShot=True)

    def on_debounce_tick(self, event):
        self._refresh_grid()

    def _refresh_grid(self):
        """
        [ATOMIC SNAPSHOT] Unificação de tarefas ativas e vídeos persistidos.
        Requisito de Fase 5.8: Visibilidade total do ciclo de vida.
        """
        # [SSOT] Atômico e Unificado: Evita duplicação visual durante a promoção
        unified_data = self.app_state.get_unified_data()
        
        # [ESTABILIDADE DE ORDEM] Garante que o ID real herde a posição do UUID
        # Como o added_at está em DD/MM/YYYY, precisamos reverter para sort correto
        def sort_key(x):
            ts = x.get('added_at') or ""
            if len(ts) >= 10 and ts[2] == '/' and ts[5] == '/':
                # Converte DD/MM/YYYY para YYYYMMDD para ordenação estável
                return ts[6:10] + ts[3:5] + ts[0:2] + ts[11:]
            return ts or "0000"

        unified_data.sort(key=sort_key, reverse=True)
        
        self.table.UpdateData(unified_data)
        self.grid.ForceRefresh()

    def on_click_process(self, event):
        raw_text = self.txt_input.GetValue().strip()
        if not raw_text: return
        
        # Ativa Gauge em modo pulsação (Indeterminado)
        self.gauge.Show()
        self.gauge.Pulse()
        self.Layout()
        
        # [SSOT] Uso do Barramento Oficial do Projeto
        PubSub.publish('REQUEST_BATCH_PROCESSING', raw_text=raw_text)
        self.txt_input.Clear()

    def on_progress_signal(self, **kwargs):
        """Atualiza a visibilidade do gauge baseado no estado da fila."""
        def update():
            active_tasks = [t for t in self.app_state.get_unified_data() if t.get('status') in ['queued', 'downloading', 'processing']]
            if not active_tasks:
                self.gauge.Hide()
            else:
                self.gauge.Show()
                # Se temos itens, paramos o pulso e deixamos explícito q algo ocorre
                # O gauge wx.Gauge não tem 'StopPulse', Hide/Show reseta se necessário.
            self.Layout()
        
        wx.CallAfter(update)

    def on_reset_safety(self, event):
        """Limpa o cooldown global para retomada de testes (PHASE_5_8_LOGICAL_SYNC)."""
        from core.cooldown_manager import CooldownManager
        CooldownManager(self.app_state).clear_cooldown()
        wx.MessageBox("Cooldown System Resetado. Você pode tentar processar novamente.", "Reset Safety", wx.OK | wx.ICON_INFORMATION)

    def _get_selected_ids(self):
        return list(self.table.selected_ids)

    def on_delete_selected(self, event):
        ids = self._get_selected_ids()
        if not ids:
            wx.MessageBox("Nenhum item selecionado.", "Aviso", wx.OK | wx.ICON_WARNING)
            return
            
        if wx.MessageBox(f"Deseja excluir {len(ids)} itens?", "Confirmação", wx.YES_NO | wx.ICON_QUESTION) == wx.YES:
            # [SSOT v5.8] AppState.delete_videos agora é polivalente e trata UUIDs e IDs.
            self.app_state.delete_videos(ids)
            self.table.selected_ids.clear()
            self._refresh_grid()

    def on_unify_md(self, event):
        ids = self._get_selected_ids()
        if not ids: return
        
        with wx.FileDialog(self, "Salvar MD Unificado", wildcard="Markdown files (*.md)|*.md",
                           style=wx.FD_SAVE | wx.FD_OVERWRITE_PROMPT) as fileDialog:
            if fileDialog.ShowModal() == wx.ID_CANCEL:
                return
            path = fileDialog.GetPath()
            
            pd = wx.ProgressDialog("Exportando...", "Gerando arquivo...", maximum=len(ids), parent=self, 
                                   style=wx.PD_APP_MODAL | wx.PD_AUTO_HIDE)
            
            def update_progress(current, total, msg):
                if pd:
                    wx.CallAfter(pd.Update, current, msg)
                    if current >= total:
                        wx.CallAfter(wx.MessageBox, "Exportação concluída!", "Sucesso", wx.OK)
            
            import threading
            t = threading.Thread(target=self.export_service.export_batch, args=(ids, "markdown_single", path, update_progress), daemon=True)
            t.start()

    def on_download_md(self, event):
        ids = self._get_selected_ids()
        if not ids: return
        
        with wx.DirDialog(self, "Selecione a pasta para exportação", style=wx.DD_DEFAULT_STYLE) as dirDialog:
            if dirDialog.ShowModal() == wx.ID_CANCEL:
                return
            folder = dirDialog.GetPath()
            
            pd = wx.ProgressDialog("Exportando...", "Salvando arquivos...", maximum=len(ids), parent=self, 
                                   style=wx.PD_APP_MODAL | wx.PD_AUTO_HIDE)
            
            def worker():
                total = len(ids)
                for i, vid in enumerate(ids):
                    meta = self.app_state.get_video(vid)
                    if meta:
                        msg = f"Salvando: {meta['title']}"
                        wx.CallAfter(pd.Update, i, msg)
                        
                        from core.export_formatter import ExportFormatter
                        t_data = self.app_state.db_handler.get_transcript(vid)
                        full_text = t_data['full_text'] if t_data else ""
                        md_content = ExportFormatter.format_video_markdown(meta, full_text)
                        filename = f"{ExportFormatter.get_safe_filename(meta['title'])}.md"
                        with open(os.path.join(folder, filename), 'w', encoding='utf-8') as f:
                            f.write(md_content)
                
                wx.CallAfter(pd.Update, total, "Concluído!")
                wx.CallAfter(wx.MessageBox, f"Exportados {len(ids)} arquivos para {folder}", "Sucesso", wx.OK)

            import threading
            t = threading.Thread(target=worker, daemon=True)
            t.start()

    def on_export_zip(self, event):
        ids = self._get_selected_ids()
        if not ids: return
        
        with wx.FileDialog(self, "Salvar ZIP", wildcard="ZIP files (*.zip)|*.zip",
                           style=wx.FD_SAVE | wx.FD_OVERWRITE_PROMPT) as fileDialog:
            if fileDialog.ShowModal() == wx.ID_CANCEL:
                return
            path = fileDialog.GetPath()
            
            pd = wx.ProgressDialog("Exportando...", "Gerando ZIP...", maximum=len(ids), parent=self, 
                                   style=wx.PD_APP_MODAL | wx.PD_AUTO_HIDE)
            
            def update_progress(current, total, msg):
                if pd:
                    wx.CallAfter(pd.Update, current, msg)
                    if current >= total:
                        wx.CallAfter(wx.MessageBox, "Arquivo ZIP gerado!", "Sucesso", wx.OK)
            
            import threading
            t = threading.Thread(target=self.export_service.export_batch, args=(ids, "zip", path, update_progress), daemon=True)
            t.start()

    def on_cancel_all(self, event):
        """Dispara sinal de cancelamento global para o Processor e AppState."""
        if wx.MessageBox("Deseja cancelar todas as tarefas pendentes?", "Confirmação", wx.YES_NO | wx.ICON_QUESTION) == wx.YES:
            PubSub.publish('REQUEST_CANCEL_ALL')
            wx.MessageBox("Comando de cancelamento enviado.", "Info", wx.OK)

    def apply_theme(self):
        """[FASE 6.2] Atualiza cores e refresca a grade de processamento."""
        self.theme = ThemeManager()
        bg = self.theme.get_bg_color()
        fg = self.theme.get_fg_color()

        self.SetBackgroundColour(bg)

        # Grid — tratamento especializado
        if hasattr(self, 'grid'):
            self.theme.apply_grid_theme(self.grid)

        # Botões com cores semânticas
        self.btn_process.SetBackgroundColour(self.theme.get_accent_color())
        self.btn_process.SetForegroundColour(wx.WHITE)

        # Input de URLs
        if hasattr(self, 'txt_input'):
            self.txt_input.SetBackgroundColour(self.theme.get_input_bg())
            self.txt_input.SetForegroundColour(self.theme.get_input_fg())

        # Botões genéricos
        for btn in [self.btn_clear, self.btn_delete, self.btn_unify,
                     self.btn_download_md, self.btn_export_zip]:
            try:
                btn.SetBackgroundColour(self.theme.get_highlight_color())
                btn.SetForegroundColour(fg)
            except Exception:
                pass

        # Botão cancelar mantém vermelho
        self.btn_cancel.SetForegroundColour(wx.Colour(200, 50, 50))

        self.Refresh()
