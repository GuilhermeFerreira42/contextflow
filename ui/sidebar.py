
# contextflow/ui/sidebar.py
import wx
import collections
from core.app_state import AppState

class Sidebar(wx.Panel):
    def __init__(self, parent, on_selection_callback, on_data_changed_callback=None, app_state: AppState = None):
        super().__init__(parent)
        self.on_selection = on_selection_callback
        self.on_data_changed = on_data_changed_callback
        self.app_state = app_state # Expected to be injected
        
        # If not injected (legacy fallback?), get singleton
        if not self.app_state:
            self.app_state = AppState()
            
        self._init_ui()
        
        # Register Observer
        self.app_state.register_observer(self._on_state_change)
        
        self.load_history()

    def _init_ui(self):
        # Re-implementing init to bind right click
        sizer = wx.BoxSizer(wx.VERTICAL)
        
        # [QA3] Header com Toggle Button
        header_sizer = wx.BoxSizer(wx.HORIZONTAL)
        
        header_lbl = wx.StaticText(self, label="Histórico")
        header_lbl.SetFont(wx.Font(10, wx.FONTFAMILY_DEFAULT, wx.FONTSTYLE_NORMAL, wx.FONTWEIGHT_BOLD))
        
        self.btn_toggle = wx.Button(self, label="☰", size=(30, 30), style=wx.BU_EXACTFIT)
        self.btn_toggle.SetToolTip("Ocultar Sidebar")
        self.btn_toggle.SetBackgroundColour(wx.Colour(240, 240, 240))
        
        header_sizer.Add(header_lbl, 1, wx.ALIGN_CENTER_VERTICAL | wx.LEFT, 5)
        header_sizer.Add(self.btn_toggle, 0, wx.RIGHT, 5)
        sizer.Add(header_sizer, 0, wx.EXPAND | wx.TOP | wx.BOTTOM, 5)

        # Search Bar
        self.search_ctrl = wx.SearchCtrl(self, style=wx.TE_PROCESS_ENTER)
        self.search_ctrl.ShowCancelButton(True)
        self.search_ctrl.SetDescriptiveText("🔍 Pesquisar...")
        self.search_ctrl.Bind(wx.EVT_TEXT, self.on_search_text)
        self.search_ctrl.Bind(wx.EVT_SEARCHCTRL_CANCEL_BTN, self.on_search_cancel)
        sizer.Add(self.search_ctrl, 0, wx.EXPAND | wx.LEFT | wx.RIGHT | wx.BOTTOM, 5)
        
        # Tree
        self.tree = wx.TreeCtrl(self, style=wx.TR_DEFAULT_STYLE | wx.TR_HIDE_ROOT)
        self.root = self.tree.AddRoot("Root")
        
        sizer.Add(self.tree, 1, wx.EXPAND | wx.ALL, 0)
        
        self.SetSizer(sizer)
 
        self.Bind(wx.EVT_TREE_SEL_CHANGED, self.on_tree_selection, self.tree)
        self.btn_toggle.Bind(wx.EVT_BUTTON, self.on_toggle_click)
        # Right Click
        self.tree.Bind(wx.EVT_TREE_ITEM_MENU, self.on_right_click)

    def _on_state_change(self, event_type, data):
        """Callback do AppState Observer."""
        # Refresh tree on relevant changes
        relevant_events = ['VIDEO_UPDATED', 'VIDEOS_DELETED', 'PLAYLIST_DELETED', 'TASK_COMPLETE'] 
        # TASK_COMPLETE is usually same as VIDEO_UPDATED (status: completed)
        
        # Optimization: We could be smarter, but reloading tree is fast enough for <1000 items usually
        # But let's filter a bit.
        if event_type in ['VIDEOS_DELETED', 'PLAYLIST_DELETED', 'VIDEO_UPDATED']:
             # Use CallAfter just in case, though notify uses it already.
             # Refreshing tree might lose expansion state...
             # For now, let's keep simple: full reload.
             self.load_history(self.search_ctrl.GetValue())

    def on_right_click(self, event):
        item = event.GetItem()
        if not item.IsOk() or item == self.root:
            return
            
        self._action_item = item
        menu = wx.Menu()
        
        data = self.tree.GetItemData(item)
        
        if data and isinstance(data, dict):
            dtype = data.get("type")
            if dtype == "video":
                menu.Append(1001, "Excluir Vídeo")
                self.Bind(wx.EVT_MENU, self.on_delete_video, id=1001)
                
                menu.AppendSeparator()
                menu.Append(1003, "Exportar Markdown (Único)")
                self.Bind(wx.EVT_MENU, lambda e: self.on_export_action(e, "markdown_single"), id=1003)
                
            elif dtype == "playlist":
                menu.Append(1002, "Excluir Playlist (Todos os vídeos)")
                self.Bind(wx.EVT_MENU, self.on_delete_playlist, id=1002)
                
                menu.AppendSeparator()
                menu.Append(1004, "Exportar ZIP (Todos)")
                self.Bind(wx.EVT_MENU, lambda e: self.on_export_action(e, "zip"), id=1004)
                menu.Append(1005, "Exportar Markdown (Único)")
                self.Bind(wx.EVT_MENU, lambda e: self.on_export_action(e, "markdown_single"), id=1005)
                
                menu.AppendSeparator()
                menu.Append(1006, "Copiar Link da Playlist")
                self.Bind(wx.EVT_MENU, self.on_copy_link, id=1006)
                
            elif dtype == "folder" and data.get("id") == "orphans":
                menu.Append(1007, "Excluir Tudo")
                self.Bind(wx.EVT_MENU, self.on_delete_orphans, id=1007)
                
                menu.AppendSeparator()
                menu.Append(1008, "Exportar Tudo (ZIP)")
                self.Bind(wx.EVT_MENU, lambda e: self.on_export_action(e, "zip"), id=1008)
        
        if menu.GetMenuItemCount() > 0:
            self.PopupMenu(menu)
        menu.Destroy()

    def on_delete_video(self, event):
        item = self._action_item
        data = self.tree.GetItemData(item)
        if data and data.get("type") == "video":
            video_id = data["id"]
            dlg = wx.MessageDialog(self, "Tem certeza que deseja excluir este vídeo?", "Confirmar Exclusão", wx.YES_NO | wx.ICON_QUESTION)
            if dlg.ShowModal() == wx.ID_YES:
                self.app_state.delete_videos([video_id]) 
                # Observer will trigger refresh
            dlg.Destroy()

    def on_delete_playlist(self, event):
        item = self._action_item
        data = self.tree.GetItemData(item)
        if data and data.get("type") == "playlist":
            pid = data["id"]
            
            dlg = wx.MessageDialog(self, "Tem certeza que deseja excluir esta Playlist e TODOS os seus vídeos?", "Confirmar Exclusão em Massa", wx.YES_NO | wx.ICON_WARNING)
            if dlg.ShowModal() == wx.ID_YES:
                self.app_state.delete_playlist(pid)
                # Observer refresh
            dlg.Destroy()

    def on_delete_orphans(self, event):
        dlg = wx.MessageDialog(self, "Tem certeza que deseja excluir TODOS os vídeos sem playlist (Individuais)?", "Confirmar Exclusão em Massa", wx.YES_NO | wx.ICON_WARNING)
        if dlg.ShowModal() == wx.ID_YES:
            self.app_state.delete_orphans()
        dlg.Destroy()

    def on_copy_link(self, event):
        item = self._action_item
        data = self.tree.GetItemData(item)
        if data and data.get("type") == "playlist":
            pid = data['id']
            url = f"https://www.youtube.com/playlist?list={pid}"
            if wx.TheClipboard.Open():
                wx.TheClipboard.SetData(wx.TextDataObject(url))
                wx.TheClipboard.Close()
                wx.MessageBox(f"Link copiado para a área de transferência:\n{url}", "Sucesso")
            else:
                 wx.MessageBox("Não foi possível acessar a área de transferência.", "Erro")


    def on_toggle_click(self, event):
        """[QA3] Dispara sinal para o Maestro ocultar a Sidebar."""
        from core.pubsub import PubSub
        PubSub.publish('REQUEST_SIDEBAR_TOGGLE')

    def on_search_text(self, event):
        text = self.search_ctrl.GetValue()
        self.load_history(filter_text=text)

    def on_search_cancel(self, event):
        self.search_ctrl.SetValue("")
        self.load_history()

    def load_history(self, filter_text=""):
        # Save expansion state if possible? Too complex for now.
        self.tree.DeleteChildren(self.root)
        
        # Use AppState
        videos = self.app_state.get_all_videos()
        
        # Filter if needed
        if filter_text:
            ft = filter_text.lower()
            videos = [v for v in videos if ft in (v.get('title') or "").lower()]

        # Agrupar por Playlist
        # [ESTRATÉGIA DE SYNC] Reconstruímos a árvore do zero a cada update.
        # Embora 'caro', garante Consistência Total com o AppState (Single Source of Truth),
        # evitando bugs visuais de itens fantasmas ou duplicados comuns em 'deltas'.
        playlists = collections.defaultdict(list)
        single_videos = []

        
        for v in videos:
            pid = v.get('playlist_id')
            if pid:
                playlists[pid].append(v)
            else:
                 # [QA3] Adição em ordem inversa já vem do AppState (Newest first)
                 # Se usarmos AppendItem, o mais novo (primeiro da lista) fica no topo do grupo
                single_videos.append(v)
        
        # Adicionar Playlists
        for pid, v_list in playlists.items():
            # Tenta pegar título da playlist do primeiro vídeo
            ptitle = v_list[0].get('playlist_title') or f"Playlist {pid}"
            
            pl_node = self.tree.AppendItem(self.root, ptitle)
            # Salva ID da playlist
            self.tree.SetItemData(pl_node, {"type": "playlist", "id": pid}) 
            
            for v in v_list:
                item = self.tree.AppendItem(pl_node, v['title'])
                self.tree.SetItemData(item, {"type": "video", "id": v['id']})
                
        # Adicionar Vídeos Soltos
        if single_videos:
            orphans_node = self.tree.AppendItem(self.root, "Vídeos Individuais")
            self.tree.SetItemData(orphans_node, {"type": "folder", "id": "orphans"})
            
            for v in single_videos:
                item = self.tree.AppendItem(orphans_node, v['title'])
                self.tree.SetItemData(item, {"type": "video", "id": v['id']})
                
        self.tree.ExpandAll()

    def refresh(self):
        """Alias para load_history, compatibilidade com interface de refresh."""
        self.load_history()

    def on_export_action(self, event, fmt):
        item = self._action_item
        data = self.tree.GetItemData(item)
        if not data: return
        
        ids = []
        default_name = "export"
        
        if data['type'] == 'video':
            ids = [data['id']]
            v = self.app_state.get_video(data['id'])
            if v:
                from core.export_formatter import ExportFormatter
                default_name = ExportFormatter.get_safe_filename(v['title'])
                
        elif data['type'] == 'playlist':
            # Get videos from AppState memory
            all_v = self.app_state.get_all_videos()
            ids = [x['id'] for x in all_v if x.get('playlist_id') == data['id']]
            default_name = f"playlist_{data['id']}"
            
        elif data['type'] == 'folder' and data['id'] == 'orphans':
             # Get all orphans
             all_v = self.app_state.get_all_videos()
             ids = [v['id'] for v in all_v if not v.get('playlist_id')]
             default_name = "videos_individuais"

        if not ids:
            wx.MessageBox("Nenhum vídeo para exportar.", "Aviso")
            return

        wildcard = "Markdown files (*.md)|*.md" if fmt == "markdown_single" else "ZIP files (*.zip)|*.zip"
        ext = ".md" if fmt == "markdown_single" else ".zip"
        
        with wx.FileDialog(self, "Salvar Exportação", wildcard=wildcard,
                           style=wx.FD_SAVE | wx.FD_OVERWRITE_PROMPT, defaultFile=default_name + ext) as fileDialog:
            if fileDialog.ShowModal() == wx.ID_CANCEL:
                return
            path = fileDialog.GetPath()
            self.run_export_thread(ids, fmt, path)

    def run_export_thread(self, ids, fmt, path):
        # Progress Dialog
        pd = wx.ProgressDialog("Exportando...", "Iniciando...", maximum=len(ids), parent=self, style=wx.PD_APP_MODAL | wx.PD_AUTO_HIDE)
        
        def update_progress(current, total, msg):
            if pd:
                try:
                    pd.Update(current, msg)
                    if current >= total:
                        wx.MessageBox(f"Exportação salva em:\n{path}", "Sucesso")
                except:
                    pass
        
        # Use Processor just to access run_export? 
        # Ideally export logic should be in Service or AppState.
        # But for now Processor has `export_batch`.
        # Create a temp processor instance IS BAD for AppState?
        # Processor __init__ creates new stuff.
        # We should probably move export logic to AppState or dedicated service.
        # But Processor needs to injected AppState.
        
        from core.processor import Processor
        proc = Processor(app_state=self.app_state)
        
        import threading
        t = threading.Thread(target=proc.export_batch, args=(ids, fmt, path, update_progress), daemon=True)
        t.start()

    def on_tree_selection(self, event):
        item = event.GetItem()
        if not item.IsOk() or item == self.root: return

        data = self.tree.GetItemData(item)
        
        # Só notifica seleção se for vídeo
        if data and isinstance(data, dict) and data.get("type") == "video":
            self.on_selection(data["id"])
