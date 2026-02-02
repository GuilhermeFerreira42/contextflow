# contextflow/ui/tab_batch.py
import wx
import wx.grid
import os
import webbrowser
from core.pubsub import PubSub
# ... (rest of imports remains same)
from core.app_state import AppState
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
        self.export_service = ExportService(self.app_state)
        self.table = VirtualVideoTable()
        
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
        self.btn_process.SetBackgroundColour(wx.Colour(0, 120, 215))
        self.btn_process.SetForegroundColour(wx.WHITE)
        
        btn_sizer.Add(self.btn_clear, 0, wx.RIGHT, 5)
        btn_sizer.Add(self.btn_reset_safety, 0, wx.RIGHT, 5)
        btn_sizer.Add(self.btn_process, 0)
        input_sizer.Add(btn_sizer, 0, wx.ALIGN_RIGHT | wx.BOTTOM | wx.RIGHT, 5)
        
        main_sizer.Add(input_sizer, 0, wx.EXPAND | wx.ALL, 10)

        # --- SEÇÃO 2: GRADE TÉCNICA (CENTER) ---
        grid_sizer = wx.BoxSizer(wx.VERTICAL)
        lbl_grid = wx.StaticText(self, label="Lista de Processamento:")
        grid_sizer.Add(lbl_grid, 0, wx.LEFT | wx.BOTTOM, 5)
        
        self.grid = wx.grid.Grid(self)
        self.grid.SetTable(self.table, takeOwnership=True)
        self.grid.SelectionMode = wx.grid.Grid.GridSelectRows
        
        # Configuração Estética HeidiSQL
        self.grid.SetColLabelSize(25)
        self.grid.SetRowLabelSize(0)
        self.grid.EnableGridLines(True)
        
        # [AFFORDANCE] Define larguras conforme SSoT de Usabilidade
        self.grid.SetColSize(0, 40)   # #
        self.grid.SetColSize(1, 40)   # [x]
        self.grid.SetColSize(2, 250)  # Link
        self.grid.SetColSize(3, 400)  # Título
        self.grid.SetColSize(10, 100) # Status
        
        grid_sizer.Add(self.grid, 1, wx.EXPAND | wx.LEFT | wx.RIGHT, 10)
        main_sizer.Add(grid_sizer, 1, wx.EXPAND)

        # --- SEÇÃO 3: BARRA DE AÇÕES (FOOTER) ---
        action_sizer = wx.BoxSizer(wx.HORIZONTAL)
        self.btn_delete = wx.Button(self, label="Excluir Selecionados")
        self.btn_unify = wx.Button(self, label="Unificar (.md)")
        self.btn_download_md = wx.Button(self, label="Baixar como MD")
        self.btn_export_zip = wx.Button(self, label="Exportar (ZIP)")
        
        action_sizer.Add(self.btn_delete, 0, wx.RIGHT, 5)
        action_sizer.Add(self.btn_unify, 0, wx.RIGHT, 5)
        action_sizer.Add(self.btn_download_md, 0, wx.RIGHT, 5)
        action_sizer.Add(self.btn_export_zip, 0)
        
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
        self.Bind(wx.EVT_TIMER, self.on_debounce_tick, self.debounce_timer)
        
        # [USABILIDADE] Eventos de Grade de Baixa Latência
        self.grid.Bind(wx.grid.EVT_GRID_CELL_LEFT_CLICK, self.on_grid_click)
        self.grid.Bind(wx.grid.EVT_GRID_LABEL_LEFT_CLICK, self.on_label_click)
        self.grid.GetGridWindow().Bind(wx.EVT_MOTION, self.on_grid_motion)

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
        # [SSOT] Uso do Barramento Oficial do Projeto
        PubSub.publish('REQUEST_BATCH_PROCESSING', raw_text=raw_text)
        self.txt_input.Clear()

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
            self.export_service.export_batch(ids, "markdown_single", path)
            wx.MessageBox("Exportação concluída!", "Sucesso", wx.OK)

    def on_download_md(self, event):
        ids = self._get_selected_ids()
        if not ids: return
        
        # Para "Baixar como MD" (individual), vamos salvar em uma pasta
        with wx.DirDialog(self, "Selecione a pasta para exportação", style=wx.DD_DEFAULT_STYLE) as dirDialog:
            if dirDialog.ShowModal() == wx.ID_CANCEL:
                return
            folder = dirDialog.GetPath()
            
            # Reutiliza lógica de ZIP mas salvando em arquivos
            # Ou melhor, adicionamos suporte no ExportService ou fazemos aqui
            for vid in ids:
                meta = self.app_state.get_video(vid)
                if meta:
                    from core.export_formatter import ExportFormatter
                    t_data = self.app_state.db_handler.get_transcript(vid)
                    full_text = t_data['full_text'] if t_data else ""
                    md_content = ExportFormatter.format_video_markdown(meta, full_text)
                    filename = f"{ExportFormatter.get_safe_filename(meta['title'])}.md"
                    with open(os.path.join(folder, filename), 'w', encoding='utf-8') as f:
                        f.write(md_content)
            
            wx.MessageBox(f"Exportados {len(ids)} arquivos para {folder}", "Sucesso", wx.OK)

    def on_export_zip(self, event):
        ids = self._get_selected_ids()
        if not ids: return
        
        with wx.FileDialog(self, "Salvar ZIP", wildcard="ZIP files (*.zip)|*.zip",
                           style=wx.FD_SAVE | wx.FD_OVERWRITE_PROMPT) as fileDialog:
            if fileDialog.ShowModal() == wx.ID_CANCEL:
                return
            path = fileDialog.GetPath()
            self.export_service.export_batch(ids, "zip", path)
            wx.MessageBox("Arquivo ZIP gerado!", "Sucesso", wx.OK)
