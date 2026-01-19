
# contextflow/ui/sidebar.py
import wx
from storage.db_handler import DatabaseHandler
import collections

class Sidebar(wx.Panel):
    def __init__(self, parent, on_selection_callback, on_data_changed_callback=None):
        super().__init__(parent)
        self.on_selection = on_selection_callback
        self.on_data_changed = on_data_changed_callback
        self.db_handler = DatabaseHandler()
        self._init_ui()
        self.load_history()



    def _init_ui(self):
        # Re-implementing init to bind right click
        sizer = wx.BoxSizer(wx.VERTICAL)
        
        # Header
        header = wx.StaticText(self, label="Histórico")
        font = header.GetFont()
        font.SetWeight(wx.FONTWEIGHT_BOLD)
        header.SetFont(font)
        sizer.Add(header, 0, wx.ALL, 5)

        # Search Bar
        self.search_ctrl = wx.SearchCtrl(self, style=wx.TE_PROCESS_ENTER)
        self.search_ctrl.ShowCancelButton(True)
        self.search_ctrl.SetDescriptiveText("🔍 Pesquisar nos títulos...")
        self.search_ctrl.Bind(wx.EVT_TEXT, self.on_search_text)
        self.search_ctrl.Bind(wx.EVT_SEARCHCTRL_CANCEL_BTN, self.on_search_cancel)
        sizer.Add(self.search_ctrl, 0, wx.EXPAND | wx.ALL, 5)
        
        # Tree
        self.tree = wx.TreeCtrl(self, style=wx.TR_DEFAULT_STYLE | wx.TR_HIDE_ROOT)
        self.root = self.tree.AddRoot("Root")
        
        sizer.Add(self.tree, 1, wx.EXPAND | wx.ALL, 0)
        
        self.SetSizer(sizer)

        self.Bind(wx.EVT_TREE_SEL_CHANGED, self.on_tree_selection, self.tree)
        # Right Click
        self.tree.Bind(wx.EVT_TREE_ITEM_MENU, self.on_right_click)

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
                self.db_handler.delete_video(video_id)
                self.load_history() 
                if self.on_data_changed:
                    # Passa action e affected_ids
                    self.on_data_changed("delete_video", [video_id])
            dlg.Destroy()

    def on_delete_playlist(self, event):
        item = self._action_item
        data = self.tree.GetItemData(item)
        if data and data.get("type") == "playlist":
            pid = data["id"]
            
            # Fetch affected videos BEFORE deletion
            affected_ids = self.db_handler.get_video_ids_for_playlist(pid)
            
            dlg = wx.MessageDialog(self, "Tem certeza que deseja excluir esta Playlist e TODOS os seus vídeos?", "Confirmar Exclusão em Massa", wx.YES_NO | wx.ICON_WARNING)
            if dlg.ShowModal() == wx.ID_YES:
                self.db_handler.delete_playlist(pid)
                self.load_history()
                if self.on_data_changed:
                    # Passa action e affected_ids
                    self.on_data_changed("delete_playlist", affected_ids)
            dlg.Destroy()

    def on_delete_orphans(self, event):
        dlg = wx.MessageDialog(self, "Tem certeza que deseja excluir TODOS os vídeos sem playlist (Individuais)?", "Confirmar Exclusão em Massa", wx.YES_NO | wx.ICON_WARNING)
        if dlg.ShowModal() == wx.ID_YES:
            deleted_ids = self.db_handler.delete_orphaned_videos()
            self.load_history()
            if self.on_data_changed and deleted_ids:
                self.on_data_changed("delete_playlist", deleted_ids) # Reuse delete_playlist logic to remove list of IDs
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


    def on_search_text(self, event):
        text = self.search_ctrl.GetValue()
        self.load_history(filter_text=text)

    def on_search_cancel(self, event):
        self.search_ctrl.SetValue("")
        self.load_history()

    def load_history(self, filter_text=""):
        self.tree.DeleteChildren(self.root)
        videos = self.db_handler.get_all_videos()
        
        # Filter if needed
        if filter_text:
            ft = filter_text.lower()
            videos = [v for v in videos if ft in (v.get('title') or "").lower()]

        # Agrupar por Playlist
        playlists = collections.defaultdict(list)
        single_videos = []
        
        for v in videos:
            pid = v.get('playlist_id')
            if pid:
                playlists[pid].append(v)
            else:
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
            # Try to get title for filename
            v = next((x for x in self.db_handler.get_all_videos() if x['id'] == data['id']), None)
            if v:
                safe_title = "".join([c for c in v['title'] if c.isalnum() or c in (' ', '-', '_')]).strip()
                default_name = safe_title
        elif data['type'] == 'playlist':
            ids = self.db_handler.get_video_ids_for_playlist(data['id'])
            default_name = f"playlist_{data['id']}"
        elif data['type'] == 'folder' and data['id'] == 'orphans':
             # Get all orphans
             all_videos = self.db_handler.get_all_videos()
             ids = [v['id'] for v in all_videos if not v.get('playlist_id')]
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
        
        from core.processor import Processor
        proc = Processor()
        
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
