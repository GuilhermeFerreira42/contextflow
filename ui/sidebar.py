
# contextflow/ui/sidebar.py
import wx
import collections
from core.app_state import AppState
from core.managers.theme_manager import ThemeManager

class Sidebar(wx.Panel):
    def __init__(self, parent, on_selection_callback, on_data_changed_callback=None, app_state: AppState = None):
        super().__init__(parent)
        self.on_selection = on_selection_callback
        self.on_data_changed = on_data_changed_callback
        self.app_state = app_state # Expected to be injected
        self.theme = ThemeManager()
        self.SetBackgroundColour(self.theme.get_bg_color())
        
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
        header_lbl.SetForegroundColour(self.theme.get_fg_color())  # [6.2d]
        
        self.btn_toggle = wx.Button(self, label="☰", size=(30, 30), style=wx.BU_EXACTFIT)
        self.btn_toggle.SetToolTip("Ocultar Sidebar")
        self.btn_toggle.SetBackgroundColour(self.theme.get_border_color())
        self.btn_toggle.SetForegroundColour(self.theme.get_fg_color())  # [6.2d]
        
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
        
        # Tree Controls [7.1.4]
        tree_ctrls = self._create_tree_controls()
        sizer.Add(tree_ctrls, 0, wx.EXPAND | wx.LEFT | wx.RIGHT | wx.BOTTOM, 5)

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
                menu.Append(1010, "✨ Resumir Vídeo")
                self.Bind(wx.EVT_MENU, self.on_summarize_video, id=1010)

                menu.AppendSeparator()
                menu.Append(1003, "Exportar Markdown (Único)")
                self.Bind(wx.EVT_MENU, lambda e: self.on_export_action(e, "markdown_single"), id=1003)

            elif dtype == "playlist":
                menu.Append(1002, "Excluir Playlist (Todos os vídeos)")
                self.Bind(wx.EVT_MENU, self.on_delete_playlist, id=1002)

                menu.AppendSeparator()
                menu.Append(1011, "✨ Resumir Playlist")
                self.Bind(wx.EVT_MENU, self.on_summarize_playlist, id=1011)

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

    def on_summarize_video(self, event):
        """[FASE 6.2] Resumir vídeo individual via sidebar."""
        item = self._action_item
        data = self.tree.GetItemData(item)
        if not data or data.get("type") != "video":
            return

        vid = data["id"]
        video = self.app_state.get_video(vid)
        if not video:
            return

        # Validação de elegibilidade
        if video.get("status") != "completed":
            wx.MessageBox(
                "Este vídeo ainda não possui transcrição concluída.\n"
                "Baixe o vídeo primeiro antes de resumir.",
                "Aviso", wx.OK | wx.ICON_WARNING)
            return

        ss = video.get("summary_status")
        if ss == "summarizing":
            wx.MessageBox("Este vídeo já está sendo resumido.",
                          "Info", wx.OK | wx.ICON_INFORMATION)
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

    def on_summarize_playlist(self, event):
        """[FASE 6.2] Resumir todos os vídeos elegíveis de uma playlist."""
        item = self._action_item
        data = self.tree.GetItemData(item)
        if not data or data.get("type") != "playlist":
            return

        pid = data["id"]
        videos = self.app_state.get_all_videos()

        # Filtra vídeos elegíveis
        eligible = []
        already_done = 0
        no_transcript = 0
        in_progress = 0

        for v in videos:
            if v.get("playlist_id") != pid:
                continue
            ss = v.get("summary_status")
            status = v.get("status", "")

            if ss == "summarized":
                already_done += 1
                continue
            if ss == "summarizing":
                in_progress += 1
                continue
            if status != "completed":
                no_transcript += 1
                continue
            eligible.append(v["id"])

        if not eligible:
            msg = "Nenhum vídeo elegível para resumo nesta playlist."
            if already_done > 0:
                msg += f"\n• {already_done} já resumido(s)"
            if in_progress > 0:
                msg += f"\n• {in_progress} em processamento"
            if no_transcript > 0:
                msg += f"\n• {no_transcript} sem transcrição"
            wx.MessageBox(msg, "Info", wx.OK | wx.ICON_INFORMATION)
            return

        # Confirmação
        msg = f"Resumir {len(eligible)} vídeo(s) da playlist?"
        if already_done > 0:
            msg += f"\n\n({already_done} já resumido(s) serão ignorados)"

        if wx.MessageBox(msg, "Confirmar Resumo em Lote",
                         wx.YES_NO | wx.ICON_QUESTION) != wx.YES:
            return

        self.app_state.request_batch_summary(eligible)


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

    def _create_tree_controls(self):
        """[7.1.4] Cria botões de controle acima da árvore de histórico."""
        ctrl_panel = wx.Panel(self)
        ctrl_sizer = wx.BoxSizer(wx.HORIZONTAL)

        self.btn_expand_all = wx.Button(ctrl_panel, wx.ID_ANY, "▼ Expandir", style=wx.BORDER_NONE)
        self.btn_collapse_all = wx.Button(ctrl_panel, wx.ID_ANY, "▶ Recolher", style=wx.BORDER_NONE)

        self.btn_expand_all.SetCursor(wx.Cursor(wx.CURSOR_HAND))
        self.btn_collapse_all.SetCursor(wx.Cursor(wx.CURSOR_HAND))

        # Estilo compacto
        font = wx.Font(8, wx.FONTFAMILY_DEFAULT, wx.FONTSTYLE_NORMAL, wx.FONTWEIGHT_NORMAL)
        self.btn_expand_all.SetFont(font)
        self.btn_collapse_all.SetFont(font)

        ctrl_sizer.Add(self.btn_expand_all, 0, wx.RIGHT, 4)
        ctrl_sizer.Add(self.btn_collapse_all, 0)

        ctrl_panel.SetSizer(ctrl_sizer)

        # Binds
        self.btn_expand_all.Bind(wx.EVT_BUTTON, self._on_expand_all)
        self.btn_collapse_all.Bind(wx.EVT_BUTTON, self._on_collapse_all)

        return ctrl_panel

    def _on_expand_all(self, event):
        self.tree.ExpandAll()

    def _on_collapse_all(self, event):
        self.tree.CollapseAll()
        root = self.tree.GetRootItem()
        if root.IsOk() and not self.tree.HasFlag(wx.TR_HIDE_ROOT):
            self.tree.Expand(root)

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
                    # [THREAD SAFETY] Progress update must be via wx.CallAfter if callback is from bg thread
                    # sidebar.py calls this from a bg thread, so we ensure UI safety.
                    wx.CallAfter(pd.Update, current, msg)
                    if current >= total:
                        wx.CallAfter(wx.MessageBox, f"Exportação salva em:\n{path}", "Sucesso")
                except:
                    pass
        
        from services.export_service import ExportService
        exp = ExportService(self.app_state)
        
        import threading
        t = threading.Thread(target=exp.export_batch, args=(ids, fmt, path, update_progress), daemon=True)
        t.start()

    def on_tree_selection(self, event):
        item = event.GetItem()
        if not item.IsOk() or item == self.root: return

        data = self.tree.GetItemData(item)
        
        if data and isinstance(data, dict) and data.get("type") == "video":
            self.on_selection(data["id"])

    def apply_theme(self):
        """[FASE 6.2c] Atualiza cores internas da Sidebar."""
        self.theme = ThemeManager()
        bg = self.theme.get_bg_color()
        fg = self.theme.get_fg_color()

        self.SetBackgroundColour(bg)
        self.tree.SetBackgroundColour(bg)
        self.tree.SetForegroundColour(fg)
        self.btn_toggle.SetBackgroundColour(self.theme.get_border_color())
        self.btn_toggle.SetForegroundColour(fg)  # [6.2d] FG do botão ☰

        # [6.2c] SearchCtrl — precisa de theming explícito no Windows
        if hasattr(self, 'search_ctrl'):
            self.search_ctrl.SetBackgroundColour(self.theme.get_input_bg())
            self.search_ctrl.SetForegroundColour(self.theme.get_input_fg())

        # [7.1.4] Atualizar botões de controle
        if hasattr(self, 'btn_expand_all'):
            self.btn_expand_all.SetBackgroundColour(self.theme.get_highlight_color())
            self.btn_expand_all.SetForegroundColour(fg)
        if hasattr(self, 'btn_collapse_all'):
            self.btn_collapse_all.SetBackgroundColour(self.theme.get_highlight_color())
            self.btn_collapse_all.SetForegroundColour(fg)

        # [6.2c] Propaga BG+FG para todos os StaticText filhos diretos
        for child in self.GetChildren():
            if isinstance(child, wx.StaticText):
                child.SetBackgroundColour(bg)
                child.SetForegroundColour(fg)

        # Recarrega árvore para aplicar novas cores nos itens
        try:
            self.load_history(self.search_ctrl.GetValue())
        except Exception:
            pass

        self.Refresh()
