
# contextflow/ui/sidebar.py
import wx
from storage.db_handler import DatabaseHandler
import collections

class Sidebar(wx.Panel):
    def __init__(self, parent, on_selection_callback):
        super().__init__(parent)
        self.on_selection = on_selection_callback
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

        # Tree
        self.tree = wx.TreeCtrl(self, style=wx.TR_DEFAULT_STYLE | wx.TR_HIDE_ROOT)
        self.root = self.tree.AddRoot("Root")
        
        sizer.Add(self.tree, 1, wx.EXPAND | wx.ALL, 0)
        
        # Refresh Button
        btn_refresh = wx.Button(self, label="Atualizar")
        btn_refresh.Bind(wx.EVT_BUTTON, lambda e: self.load_history())
        sizer.Add(btn_refresh, 0, wx.EXPAND | wx.ALL, 2)
        
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
            elif dtype == "playlist":
                menu.Append(1002, "Excluir Playlist (Todos os vídeos)")
                self.Bind(wx.EVT_MENU, self.on_delete_playlist, id=1002)
        
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
            dlg.Destroy()

    def on_delete_playlist(self, event):
        item = self._action_item
        # Precisamos descobrir o Playlist ID
        # No load_history, a gente não salvou o playlist ID no ItemData (salvou None).
        # Vamos ter que mudar o load_history para salvar o Playlist ID no ItemData.
        # OU buscamos pelo texto (frágil).
        # O melhor é refatorar load_history para salvar dados na pasta.
        pass # Placeholder until load_history refactor


    def load_history(self):
        self.tree.DeleteChildren(self.root)
        videos = self.db_handler.get_all_videos()
        
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
            # Salva ID da playlist (prefixo 'PL:' para distinguir de Video ID se necessário, mas aqui pid é string)
            # Para evitar conflito se um vídeoid for igual a um playlistid (improvável), podemos usar uma tupla
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

    def on_delete_playlist(self, event):
        item = self._action_item
        data = self.tree.GetItemData(item)
        if data and data.get("type") == "playlist":
            pid = data["id"]
            dlg = wx.MessageDialog(self, "Tem certeza que deseja excluir esta Playlist e TODOS os seus vídeos?", "Confirmar Exclusão em Massa", wx.YES_NO | wx.ICON_WARNING)
            if dlg.ShowModal() == wx.ID_YES:
                self.db_handler.delete_playlist(pid)
                self.load_history()
            dlg.Destroy()

    def on_tree_selection(self, event):
        item = event.GetItem()
        if not item.IsOk() or item == self.root: return

        data = self.tree.GetItemData(item)
        
        # Só notifica seleção se for vídeo
        if data and isinstance(data, dict) and data.get("type") == "video":
            self.on_selection(data["id"])
