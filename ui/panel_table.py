
import wx
import wx.dataview
import os
import datetime
import webbrowser
from storage.db_handler import DatabaseHandler
from core.processor import Processor

class PanelTable(wx.Panel):
    def __init__(self, parent, on_selection_callback=None):
        super().__init__(parent)
        self.db_handler = DatabaseHandler()
        self.on_selection = on_selection_callback
        
        # Processor para resumos (sob demanda)
        self.processor = Processor()
        
        self.video_map = {} # Map index or object to video data
        
        self._init_ui()
        self.load_data()

    def _init_ui(self):
        main_sizer = wx.BoxSizer(wx.VERTICAL)

        # --- Toolbar ---
        toolbar_panel = wx.Panel(self)
        toolbar_panel.SetBackgroundColour(wx.Colour(253, 253, 253))
        
        toolbar_sizer = wx.BoxSizer(wx.HORIZONTAL)
        
        # Search
        self.search_ctrl = wx.SearchCtrl(toolbar_panel, style=wx.TE_PROCESS_ENTER)
        self.search_ctrl.SetDescriptiveText("🔍 Filtrar nesta tabela...")
        self.search_ctrl.SetMinSize((250, -1))
        self.search_ctrl.Bind(wx.EVT_TEXT, self.on_filter_text)
        toolbar_sizer.Add(self.search_ctrl, 0, wx.ALIGN_CENTER_VERTICAL | wx.RIGHT, 10)
        
        # Buttons
        self.btn_summarize = wx.Button(toolbar_panel, label="✨ Resumir")
        self.btn_summarize.Bind(wx.EVT_BUTTON, self.on_summarize)
        toolbar_sizer.Add(self.btn_summarize, 0, wx.ALIGN_CENTER_VERTICAL | wx.RIGHT, 5)
        
        self.btn_export = wx.Button(toolbar_panel, label="Exportar MD")
        self.btn_export.Bind(wx.EVT_BUTTON, self.on_export_md)
        toolbar_sizer.Add(self.btn_export, 0, wx.ALIGN_CENTER_VERTICAL | wx.RIGHT, 15)
        
        # Checkbox Hide Thumbs
        self.chk_thumbs = wx.CheckBox(toolbar_panel, label="Ocultar Thumbnails")
        self.chk_thumbs.Bind(wx.EVT_CHECKBOX, self.on_toggle_thumbs)
        toolbar_sizer.Add(self.chk_thumbs, 0, wx.ALIGN_CENTER_VERTICAL)

        # Set Sizer for Toolbar Panel
        tp_sizer = wx.BoxSizer(wx.HORIZONTAL)
        tp_sizer.Add(toolbar_sizer, 1, wx.ALL, 6)
        toolbar_panel.SetSizer(tp_sizer)
        
        main_sizer.Add(toolbar_panel, 0, wx.EXPAND | wx.BOTTOM, 1)

        # --- Data View Ctrl ---
        self.dv_ctrl = wx.dataview.DataViewListCtrl(self, style=wx.dataview.DV_ROW_LINES | wx.dataview.DV_HORIZ_RULES | wx.dataview.DV_VERT_RULES)
        self.dv_ctrl.SetRowHeight(50) # Altura maior para thumbnails e texto
        
        # Colunas
        # 0: CheckBox
        self.col_check = self.dv_ctrl.AppendToggleColumn(" [x] ", mode=wx.dataview.DATAVIEW_CELL_ACTIVATABLE, width=40)
        
        # 1: Thumbnail (IconText because ListCtrl handles it better than raw Bitmap column)
        self.col_thumb = self.dv_ctrl.AppendIconTextColumn("Thumb", width=90, mode=wx.dataview.DATAVIEW_CELL_INERT)
            
        # 2: Título
        self.dv_ctrl.AppendTextColumn("Título", width=220, mode=wx.dataview.DATAVIEW_CELL_INERT)
        
        # 3: Canal
        self.dv_ctrl.AppendTextColumn("Canal", width=120, mode=wx.dataview.DATAVIEW_CELL_INERT)
        
        # 4: Duração
        self.dv_ctrl.AppendTextColumn("Duração", width=80, mode=wx.dataview.DATAVIEW_CELL_INERT)
        
        # 5: Transcrição (Trecho)
        self.dv_ctrl.AppendTextColumn("Transcrição", width=280, mode=wx.dataview.DATAVIEW_CELL_INERT)
        
        # 6: Resumo
        self.dv_ctrl.AppendTextColumn("Resumo", width=200, mode=wx.dataview.DATAVIEW_CELL_INERT)
        
        # 7: Link (URL) 
        self.dv_ctrl.AppendTextColumn("Link", width=150, mode=wx.dataview.DATAVIEW_CELL_INERT)
        
        self.dv_ctrl.Bind(wx.dataview.EVT_DATAVIEW_ITEM_ACTIVATED, self.on_item_activated)
        
        main_sizer.Add(self.dv_ctrl, 1, wx.EXPAND)
        self.SetSizer(main_sizer)
        self.Layout() # Ensure layout

        
        self.all_videos = []
        self.filtered_videos = []

    def on_toggle_thumbs(self, event):
        # DataViewColumn visibility
        if self.chk_thumbs.GetValue():
            self.col_thumb.SetWidth(0)
            self.col_thumb.SetMinWidth(0)
        else:
            self.col_thumb.SetWidth(90)
            self.col_thumb.SetMinWidth(90)
        self.dv_ctrl.Refresh()

    def format_duration(self, seconds):
        if not seconds: return "00:00:00"
        try:
            val = float(seconds)
            return str(datetime.timedelta(seconds=int(val)))
        except:
            return str(seconds)

    def load_data(self):
        self.dv_ctrl.DeleteAllItems()
        self.all_videos = self.db_handler.get_all_videos()
        self.all_videos.sort(key=lambda x: x['created_at'], reverse=True)
        self.apply_filter()

    def apply_filter(self):
        query = self.search_ctrl.GetValue().lower()
        self.filtered_videos = []
        
        if not query:
            self.filtered_videos = self.all_videos
        else:
            self.filtered_videos = [
                v for v in self.all_videos 
                if query in (v['title'] or "").lower() or 
                   query in (v.get('channel_name') or "").lower()
            ]
            
        self.populate_list()

    def populate_list(self):
        self.dv_ctrl.DeleteAllItems()
        self.video_map = {}
        
        # Prepared default entries
        for i, v in enumerate(self.filtered_videos):
            # 0: Check (False)
            # 1: IconText (for Thumbnail)
            thumb_path = v.get('thumbnail_path')
            bmp = wx.NullBitmap
            if thumb_path and os.path.exists(thumb_path):
                try:
                    img = wx.Image(thumb_path, wx.BITMAP_TYPE_ANY)
                    if img.IsOk():
                        img = img.Scale(80, 45, wx.IMAGE_QUALITY_HIGH)
                        bmp = wx.Bitmap(img)
                except:
                    pass
            
            if not bmp.IsOk():
                # Default gray
                default_img = wx.Image(80, 45)
                default_img.Replace(0,0,0, 200,200,200)
                bmp = wx.Bitmap(default_img)
            
            # Convert Bitmap to Icon for IconText
            icon = wx.Icon()
            icon.CopyFromBitmap(bmp)
            icon_text = wx.dataview.DataViewIconText("", icon)

            title = v.get('title') or "Sem Título"
            channel = v.get('channel_name') or v.get('channel') or "-"
            duration = self.format_duration(v.get('duration'))
            transcript = v.get('transcript_snippet') or "..."
            summary = v.get('summary_text') or "Clique em Resumir"
            link = v.get('url') or ""
            
            # Append data: [Check, IconText, Title, Channel, Duration, Transcript, Summary, Link]
            data = [False, icon_text, title, channel, duration, transcript, summary, link]
            self.dv_ctrl.AppendItem(data)
            
            # Map Row to Video ID (Using index)
            self.video_map[i] = v

    def on_filter_text(self, event):
        self.apply_filter()

    def on_item_activated(self, event):
        # Double click
        item = event.GetItem()
        if not item.IsOk(): return
        
        row = self.dv_ctrl.ItemToRow(item)
        if 0 <= row < len(self.filtered_videos):
            # Check if clicked on Link Column (Index 7)
            # DataViewEvent doesn't easily give Column index on activation in ListCtrl mode sometimes,
            # but we can assume activation generally opens details.
            # Special case: user wants link column to open browser.
            # We can handle selection logic:
            
            video = self.filtered_videos[row]
            
            # For simplicity: Double click ANYWHERE opens details.
            # To handle link specific: we could check column or add button.
            # Let's check selection context if possible, or just open details.
            
            # If user explicitly wants link opening, we can simulate or check mouse pos,
            # but standard UI practice: double click row = details. 
            # Context menu or specific action = link.
            
            # Let's trigger "Open Details" by default.
            if self.on_selection:
                self.on_selection(video['id'])

    def get_checked_videos(self):
        checked = []
        count = self.dv_ctrl.GetItemCount()
        for i in range(count):
            # Check col 0 value
            is_checked = self.dv_ctrl.GetValue(i, 0) # Row i, Col 0
            if is_checked:
                if i < len(self.filtered_videos):
                    checked.append(self.filtered_videos[i])
        return checked

    def on_summarize(self, event):
        videos = self.get_checked_videos()
        if not videos:
            wx.MessageBox("Selecione vídeos na coluna [x].", "Aviso")
            return
            
        wx.MessageBox(f"Resumindo {len(videos)} vídeos...", "Info")
        # Logic to call processor (mocked)
        # In real implementation:
        # self.processor.summarize_batch([v['id'] for v in videos])

    def on_export_md(self, event):
        videos = self.get_checked_videos()
        # If none checked, export ALL visible (filtered)
        if not videos:
             videos = self.filtered_videos
             
        if not videos:
            wx.MessageBox("Nenhum vídeo para exportar.", "Aviso")
            return

        # Fetch FULL transcripts for these videos
        # Optimization: Fetch one by one or batch?
        # db_handler.get_transcript(vid) returns full dict
        
        md_content = f"# Exportação ContextFlow\nData: {datetime.datetime.now()}\n\n"
        
        for v in videos:
            v_id = v['id']
            full_data = self.db_handler.get_transcript(v_id)
            
            full_text = ""
            if full_data and full_data.get('full_text'):
                full_text = full_data['full_text']
            else:
                full_text = "(Transcrição não disponível)"
                
            md_content += f"## {v['title']}\n"
            md_content += f"- **Canal**: {v.get('channel_name') or '-'}\n"
            md_content += f"- **URL**: {v.get('url')}\n"
            md_content += f"- **Duração**: {self.format_duration(v.get('duration'))}\n\n"
            md_content += "### Resumo\n"
            md_content += f"{v.get('summary_text') or 'N/A'}\n\n"
            md_content += "### Transcrição Completa\n"
            md_content += f"{full_text}\n"
            md_content += "\n---\n\n"
            
        with wx.FileDialog(self, "Salvar Markdown", wildcard="Markdown (*.md)|*.md",
                           style=wx.FD_SAVE | wx.FD_OVERWRITE_PROMPT) as dlg:
            if dlg.ShowModal() == wx.ID_OK:
                path = dlg.GetPath()
                try:
                    with open(path, 'w', encoding='utf-8') as f:
                        f.write(md_content)
                    wx.MessageBox(f"Arquivo salvo: {path}", "Sucesso")
                except Exception as e:
                    wx.LogError(f"Erro ao salvar: {e}")

