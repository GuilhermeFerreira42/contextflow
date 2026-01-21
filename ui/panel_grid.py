
# contextflow/ui/panel_grid.py
import wx
import wx.grid
import webbrowser
import time
import datetime
import threading
from core.processor import Processor
from core.app_state import AppState
from services.utils import format_duration

class GridPanel(wx.Panel):
    def __init__(self, parent, on_data_changed=None, log_callback=None, app_state=None):
        super().__init__(parent)
        self.on_data_changed = on_data_changed
        self.log_callback = log_callback
        # Usa o Singleton se não for injetado
        self.app_state = app_state if app_state else AppState()
        # FIX: V9 usa db_handler, não db; Explicit fix for AttributeError
        self.db_handler = getattr(self.app_state, 'db_handler', None) or getattr(self.app_state, 'db', None)
        # Fallback just in case, but architecture says db_handler.
        if not self.db_handler:
             # Try to instantiate if missing (should not happen with singleton)
             from storage.db_handler import DatabaseHandler
             self.db_handler = DatabaseHandler()

        # Mapeamento para rastrear onde cada vídeo/tarefa está na Grid
        # Key: ID ou UUID -> Value: Row Index
        self.row_map = {} 
        self.row_ids = [] # Lista ordenada de IDs para manter sincronia

        # Registrar como listener do AppState
        self.app_state.register_observer(self.on_app_state_updated)
        
        # Inicializa Processor injetando AppState (V9 requirement)
        self.processor = Processor(self.app_state)
        
        # Conecta callbacks legacy para garantir feedback imediato enquanto migramos
        self.processor.on_task_update = self.on_task_update_legacy
        self.processor.on_error = self.on_task_error_legacy
        
        self.processor.start_processing() 
        
        self._init_ui()
        
        # Carrega dados iniciais
        self.load_data()
        
        # Restaura tarefas ativas que podem estar na memória
        self.restore_active_tasks()

    def _init_ui(self):
        main_sizer = wx.BoxSizer(wx.VERTICAL)
        
        # 1. Cabeçalho (Dashboard)
        lbl_head = wx.StaticText(self, label="Dashboard")
        font = lbl_head.GetFont()
        font.SetPointSize(12)
        font.SetWeight(wx.FONTWEIGHT_BOLD)
        lbl_head.SetFont(font)
        main_sizer.Add(lbl_head, 0, wx.ALL, 10)

        # 2. Área de Input
        input_sizer = wx.StaticBoxSizer(wx.VERTICAL, self, "Adicionar URLs (Youtube Vídeo ou Playlist)")
        self.txt_input = wx.TextCtrl(self, style=wx.TE_MULTILINE, size=(-1, 60))
        input_sizer.Add(self.txt_input, 1, wx.EXPAND | wx.ALL, 5)
        
        btn_sizer = wx.BoxSizer(wx.HORIZONTAL)
        # Tamanhos simétricos restaurados
        self.btn_process = wx.Button(self, label="Processar Fila", size=(180, 40))
        self.btn_process.Bind(wx.EVT_BUTTON, self.on_click_process)
        
        self.btn_clear_input = wx.Button(self, label="Limpar Fila", size=(180, 40))
        self.btn_clear_input.Bind(wx.EVT_BUTTON, lambda e: self.txt_input.Clear())

        btn_sizer.Add(self.btn_process, 0, wx.RIGHT, 5) 
        btn_sizer.Add(self.btn_clear_input, 0)
        
        input_sizer.Add(btn_sizer, 0, wx.EXPAND | wx.ALL, 5)
        main_sizer.Add(input_sizer, 0, wx.EXPAND | wx.ALL, 5)

        # 3. Grid Table (RESTAURADA COM 11 COLUNAS)
        self.grid = wx.grid.Grid(self)
        self.grid.CreateGrid(0, 11) 
        
        # Col Headers Originais
        cols = [" [x] ", "ID", "Link", "Título", "Canal", "Publicado", "Adicionado", "Playlist", "Duração", "Tokens", "Status"]
        for i, col in enumerate(cols):
            self.grid.SetColLabelValue(i, col)
            
        self.grid.SetColFormatBool(0) # Checkbox
        
        # Tamanhos (Restaurados do V8)
        self.grid.SetColSize(0, 40)  # [x]
        self.grid.SetColSize(1, 80)  # ID
        self.grid.SetColSize(2, 200) # Link
        self.grid.SetColSize(3, 300) # Título
        self.grid.SetColSize(4, 150) # Canal
        self.grid.SetColSize(5, 90)  # Publicado
        self.grid.SetColSize(6, 120) # Adicionado
        self.grid.SetColSize(7, 150) # Playlist
        self.grid.SetColSize(8, 70)  # Duração
        self.grid.SetColSize(9, 60)  # Tokens
        self.grid.SetColSize(10, 100) # Status (Expanded a bit)
        
        self.grid.EnableEditing(False) # ReadOnly geral (células específicas tratadas depois)
        
        # Eventos
        self.grid.Bind(wx.grid.EVT_GRID_LABEL_LEFT_CLICK, self.on_header_click)
        self.grid.Bind(wx.grid.EVT_GRID_CELL_LEFT_CLICK, self.on_cell_click)
        self.grid.GetGridWindow().Bind(wx.EVT_MOTION, self.on_grid_motion)
        
        main_sizer.Add(self.grid, 1, wx.EXPAND | wx.ALL, 5)
        
        # 4. Footer Actions (BOTÕES RESTAURADOS)
        action_sizer = wx.BoxSizer(wx.HORIZONTAL)
        
        self.btn_delete = wx.Button(self, label="Excluir Selecionados")
        self.btn_delete.Bind(wx.EVT_BUTTON, self.on_delete_selected)
        
        self.btn_unify = wx.Button(self, label="Unificar Selecionados (.md)")
        self.btn_unify.Bind(wx.EVT_BUTTON, self.on_unify_selected)

        self.btn_export = wx.Button(self, label="Exportar Selecionados (ZIP)")
        self.btn_export.Bind(wx.EVT_BUTTON, self.on_export)
        
        self.lbl_status = wx.StaticText(self, label="Pronto.")
        
        action_sizer.Add(self.lbl_status, 1, wx.ALIGN_CENTER_VERTICAL)
        action_sizer.Add(self.btn_delete, 0, wx.ALIGN_CENTER_VERTICAL | wx.RIGHT, 5)
        action_sizer.Add(self.btn_unify, 0, wx.ALIGN_CENTER_VERTICAL | wx.RIGHT, 5)
        action_sizer.Add(self.btn_export, 0, wx.ALIGN_CENTER_VERTICAL)
        
        main_sizer.Add(action_sizer, 0, wx.EXPAND | wx.ALL, 5)
        
        self.SetSizer(main_sizer)

    # --- Data Loading & Architecture ---

    def load_data(self):
        """Carrega dados persistidos do AppState."""
        if self.grid.GetNumberRows() > 0:
            self.grid.DeleteRows(0, self.grid.GetNumberRows())
        
        self.row_map = {}
        self.row_ids = []
            
        videos = self.app_state.get_all_videos()
        for v in videos:
            self.add_or_update_row_logic(v['id'], v)

    def restore_active_tasks(self):
        """Restaura tarefas ativas da memória do AppState (Queue/Downloading)."""
        active_tasks = self.app_state.get_active_downloads()
        for task in active_tasks:
            tid = task.get('uuid') or task.get('id')
            if tid:
                self.add_or_update_row_logic(tid, task)

    # --- Observer Handler (Ponte AppState -> Grid) ---

    def on_app_state_updated(self, event_type, data):
        if not wx.IsMainThread():
            wx.CallAfter(self.on_app_state_updated, event_type, data)
            return

        # Flicker Reduction
        self.grid.BeginBatch()
        try:
            if event_type in ['TASK_ADDED', 'TASK_UPDATED']:
                # data é UUID
                task_data = None
                for t in self.app_state.get_active_downloads():
                    if t.get('uuid') == data:
                        task_data = t
                        break
                if task_data:
                    self.add_or_update_row_logic(data, task_data)

            elif event_type == 'VIDEO_UPDATED':
                # data é Video ID
                video_data = self.app_state.get_video(data)
                if video_data:
                    self.add_or_update_row_logic(data, video_data)
                    
            elif event_type == 'VIDEOS_DELETED':
                 # data é lista de IDs
                 if data: self.remove_items(data)
        finally:
            self.grid.EndBatch()

    # --- Grid Rendering Logic (O Coração da UI) ---

    # --- Grid Rendering Logic (O Coração da UI) ---

    def add_or_update_row_logic(self, row_id, data):
        """
        Lógica central que desenha a linha e gerencia a promoção de UUID -> VideoID.
        row_id: Pode ser UUID (tarefa) ou VideoID (final).
        data: Dict com os dados.
        """
        row_id = str(row_id)
        row_idx = -1
        
        # 1. Tenta achar pelo ID definitivo
        if row_id in self.row_ids:
            row_idx = self.row_ids.index(row_id)
        else:
            # 2. SEGUNDA CHANCE: Tenta achar pelo UUID que veio no 'data'
            temp_uuid = str(data.get('uuid', ''))
            
            # Verifica se temos esse UUID rastreado
            if temp_uuid and temp_uuid in self.row_ids:
                row_idx = self.row_ids.index(temp_uuid)
                
                # PROMOÇÃO: Substitui o UUID temporário pelo ID real na lista
                self.row_ids[row_idx] = row_id
                
                # Manutenção do row_map (Sync com a lista)
                if temp_uuid in self.row_map:
                    del self.row_map[temp_uuid]
                self.row_map[row_id] = row_idx
            
            # Fallback para row_map se não achou na lista (caso de inconsistência, mas priorizamos lista)
            elif row_id in self.row_map:
                row_idx = self.row_map[row_id]

        # 3. Se não achou de jeito nenhum, aí sim cria linha nova
        if row_idx == -1:
            self.grid.AppendRows(1)
            row_idx = self.grid.GetNumberRows() - 1
            
            self.row_ids.append(row_id)
            self.row_map[row_id] = row_idx
            
            # Alinhamento padrão
            for c in range(11):
                self.grid.SetCellAlignment(row_idx, c, wx.ALIGN_LEFT, wx.ALIGN_CENTER)
                self.grid.SetReadOnly(row_idx, c, True)
            
            # Checkbox editável
            self.grid.SetReadOnly(row_idx, 0, False) 

        # --- Preenchimento das Colunas ---
        
        # 0: [x] - Manter estado existente se possível
        current_check = self.grid.GetCellValue(row_idx, 0)
        if current_check not in ["0", "1"]: 
            self.grid.SetCellValue(row_idx, 0, "0")

        # 1: ID
        display_id = str(data.get('id') or data.get('uuid') or "...")
        self.grid.SetCellValue(row_idx, 1, display_id)

        # 2: Link
        url = data.get('url', '')
        self.grid.SetCellValue(row_idx, 2, url)
        if url: self.grid.SetCellTextColour(row_idx, 2, wx.BLUE)

        # 3: Título
        self.grid.SetCellValue(row_idx, 3, data.get('title', 'Aguardando...'))

        # 4: Canal
        self.grid.SetCellValue(row_idx, 4, data.get('channel_name') or "-")

        # 5: Publicado (Data)
        raw_date = str(data.get('upload_date') or "")
        if len(raw_date) == 8 and raw_date.isdigit():
            fmt_date = f"{raw_date[6:8]}/{raw_date[4:6]}/{raw_date[0:4]}"
            self.grid.SetCellValue(row_idx, 5, fmt_date)
        else:
            self.grid.SetCellValue(row_idx, 5, raw_date)

        # 6: Adicionado em
        self.grid.SetCellValue(row_idx, 6, str(data.get('added_at') or ""))

        # 7: Playlist
        self.grid.SetCellValue(row_idx, 7, data.get('playlist_title') or "-")

        # 8: Duração
        dur = data.get('duration_seconds') or data.get('duration')
        if isinstance(dur, (int, float)):
            self.grid.SetCellValue(row_idx, 8, format_duration(int(dur)))
        else:
            self.grid.SetCellValue(row_idx, 8, str(dur) if dur else "00:00:00")

        # 9: Tokens
        self.grid.SetCellValue(row_idx, 9, str(data.get('token_count', 0)))

        # 10: Status
        status = data.get('status', 'pending')
        self.grid.SetCellValue(row_idx, 10, status)
        
        # Cores de Status
        if status == 'ERROR':
            self.grid.SetCellTextColour(row_idx, 10, wx.RED)
        elif status in ['completed', 'downloaded']:
            self.grid.SetCellTextColour(row_idx, 10, wx.BLACK) 
        else:
            self.grid.SetCellTextColour(row_idx, 10, wx.Colour(200, 100, 0)) # Laranja

        self.grid.ForceRefresh()

    def remove_items(self, ids_to_remove):
        """Remove linhas baseado na lista de IDs e limpa referências."""
        if not ids_to_remove: return
        
        # Encontra índices para remover usando row_map (muito mais rápido)
        indices_to_remove = []
        for rid in ids_to_remove:
            rid = str(rid)
            if rid in self.row_map:
                indices_to_remove.append(self.row_map[rid])
        
        if not indices_to_remove:
            return

        # Remove do maior para o menor para manter integridade dos índices durante loop
        for idx in sorted(indices_to_remove, reverse=True):
            self.grid.DeleteRows(idx, 1)
            # Remove da lista linear
            if idx < len(self.row_ids):
                self.row_ids.pop(idx)
        
        # Como DeleteRows desloca índices para cima, PRECISAMOS reconstruir o mapa 
        # para garantir que os índices apontem para as linhas certas agora.
        # É mais seguro e rápido do que tentar calcular o shift delta.
        self._rebuild_row_map()
            
        self.grid.ForceRefresh()

    def _rebuild_row_map(self):
        """Reconstrói o mapa de índices após deleção."""
        self.row_map = {}
        for i, rid in enumerate(self.row_ids):
            self.row_map[rid] = i

    # --- Callbacks Legacy ---
    def on_task_update_legacy(self, vid, status):
        # Encontra linha e atualiza status visualmente rápido
        # Pode ser que vid seja UUID ou ID
        # Se vid não estiver em row_ids mas for um UUID que temos... 
        # Mas add_or_update_row_logic deve ter cuidado disso.
        # Aqui é só feedback visual rápido.
        for i, rid in enumerate(self.row_ids):
            if rid == vid:
                self.grid.SetCellValue(i, 10, status)
                self.grid.SetCellTextColour(i, 10, wx.Colour(200, 100, 0))
                break
        self.lbl_status.SetLabel(f"[{vid}] {status}")

    def on_task_error_legacy(self, vid, msg):
        self.lbl_status.SetLabel(f"Erro: {msg}")

    # --- User Actions ---

    def on_click_process(self, event):
        raw_text = self.txt_input.GetValue().strip()
        if not raw_text:
            return
        
        self.lbl_status.SetLabel("Processando...")
        self.processor.add_urls(raw_text)
        self.txt_input.Clear()

    def on_cell_click(self, event):
        row = event.GetRow()
        col = event.GetCol()
        
        # Checkbox Logic
        if col == 0:
            val = self.grid.GetCellValue(row, 0)
            new_val = "1" if val == "0" else "0"
            self.grid.SetCellValue(row, 0, new_val)
            self.grid.ForceRefresh()
        
        # Link Logic
        elif col == 2:
            url = self.grid.GetCellValue(row, 2)
            if url.startswith('http'):
                webbrowser.open(url)
        
        event.Skip()

    def on_header_click(self, event):
        if event.GetCol() == 0:
            rows = self.grid.GetNumberRows()
            if rows == 0: return
            first_val = self.grid.GetCellValue(0, 0)
            new_val = "1" if first_val == "0" else "0"
            for i in range(rows):
                self.grid.SetCellValue(i, 0, new_val)
            self.grid.ForceRefresh()
        else:
            event.Skip()

    def on_grid_motion(self, event):
        x, y = self.grid.CalcUnscrolledPosition(event.GetX(), event.GetY())
        row, col = self.grid.XYToCell(x, y)
        if col == 2 and row >= 0:
            self.grid.SetCursor(wx.Cursor(wx.CURSOR_HAND))
        else:
            self.grid.SetCursor(wx.Cursor(wx.CURSOR_ARROW))
        event.Skip()

    def get_selected_ids(self):
        ids = []
        for i in range(self.grid.GetNumberRows()):
            if self.grid.GetCellValue(i, 0) == "1":
                if i < len(self.row_ids):
                    ids.append(self.row_ids[i])
        return ids

    def on_delete_selected(self, event):
        ids = self.get_selected_ids()
        if not ids: return
        if wx.MessageBox(f"Apagar {len(ids)} itens?", "Confirmar", wx.YES_NO) == wx.YES:
            self.app_state.delete_videos(ids)

    def on_unify_selected(self, event):
        ids = self.get_selected_ids()
        if not ids: return
        with wx.FileDialog(self, "Salvar Unificado", wildcard="Markdown (*.md)|*.md",
                           style=wx.FD_SAVE | wx.FD_OVERWRITE_PROMPT, 
                           defaultFile=f"unificado_{int(time.time())}.md") as dlg:
            if dlg.ShowModal() == wx.ID_OK:
                path = dlg.GetPath()
                self.run_export_thread(ids, "markdown_single", path)

    def on_export(self, event):
        ids = self.get_selected_ids()
        if not ids: return
        with wx.FileDialog(self, "Salvar ZIP", wildcard="ZIP (*.zip)|*.zip",
                           style=wx.FD_SAVE | wx.FD_OVERWRITE_PROMPT, 
                           defaultFile=f"export_{int(time.time())}.zip") as dlg:
            if dlg.ShowModal() == wx.ID_OK:
                path = dlg.GetPath()
                self.run_export_thread(ids, "zip", path)

    def run_export_thread(self, ids, fmt, path):
        pd = wx.ProgressDialog("Exportando...", "Iniciando...", maximum=len(ids), parent=self, style=wx.PD_APP_MODAL | wx.PD_AUTO_HIDE)
        
        def update_progress(current, total, msg):
            if pd:
                try:
                    pd.Update(current, msg)
                    if current >= total:
                        wx.MessageBox(f"Concluído!\nSalvo em: {path}", "Sucesso")
                except: pass
        
        import threading
        t = threading.Thread(target=self.processor.export_batch, args=(ids, fmt, path, update_progress), daemon=True)
        t.start()