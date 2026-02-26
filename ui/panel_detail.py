
# contextflow/ui/panel_detail.py
import wx
import wx.html2
import os
import markdown
from constants import THUMBNAILS_DIR, COLOR_ACCENT
from core.pubsub import PubSub
from core.app_state import AppState

class DetailPanel(wx.Panel):
    def __init__(self, parent):
        super().__init__(parent)
        self.app_state = AppState()
        self.current_video_id = None
        self.SetBackgroundColour(wx.WHITE)
        self.SetForegroundColour(wx.Colour(40, 40, 40)) # COLOR_FG
        self._init_ui()
        self._bind_events()

    def _bind_events(self):
        PubSub.subscribe('SUMMARY_STREAM', self.on_summary_stream)
        PubSub.subscribe('SUMMARY_COMPLETED', self.on_summary_completed)
        PubSub.subscribe('SUMMARY_STARTED', self.on_summary_started)

    def _init_ui(self):
        main_sizer = wx.BoxSizer(wx.VERTICAL)
        
        # 1. Header (Info Area)
        header_sizer = wx.BoxSizer(wx.HORIZONTAL)
        
        # Thumbnail Image
        self.img_thumb = wx.StaticBitmap(self, size=(160, 90)) # 16:9 ratio approx
        self.set_default_image()
        header_sizer.Add(self.img_thumb, 0, wx.ALL, 5)
        
        # Meta Info
        meta_sizer = wx.BoxSizer(wx.VERTICAL)
        self.lbl_title = wx.StaticText(self, label="Selecione um vídeo")
        title_font = self.lbl_title.GetFont()
        title_font.SetPointSize(12)
        title_font.SetWeight(wx.FONTWEIGHT_BOLD)
        self.lbl_title.SetFont(title_font)
        
        self.lbl_meta = wx.StaticText(self, label="")
        
        meta_sizer.Add(self.lbl_title, 0, wx.BOTTOM, 5)
        meta_sizer.Add(self.lbl_meta, 0)
        
        header_sizer.Add(meta_sizer, 1, wx.EXPAND | wx.ALL, 5)
        main_sizer.Add(header_sizer, 0, wx.EXPAND | wx.BOTTOM, 10)
        
        # 2. Content (WebView for Rich Text)
        if wx.html2.WebView.IsBackendAvailable(wx.html2.WebViewBackendDefault):
            self.browser = wx.html2.WebView.New(self)
            # [QA2 REFINE] Evita Flash Preto: Injeta fundo branco imediatamente
            self.browser.SetPage("<html><body style='background-color:white;'></body></html>", "")
            main_sizer.Add(self.browser, 1, wx.EXPAND | wx.ALL, 0)
        else:
            self.txt_content = wx.TextCtrl(self, style=wx.TE_MULTILINE | wx.TE_READONLY | wx.NO_BORDER)
            self.txt_content.SetBackgroundColour(wx.WHITE)
            self.txt_content.SetForegroundColour(wx.Colour(40, 40, 40))
            main_sizer.Add(self.txt_content, 1, wx.EXPAND | wx.ALL, 0)
            self.browser = None
            
        # 3. Footer (Stats/Actions)
        footer_sizer = wx.BoxSizer(wx.HORIZONTAL)
        self.lbl_stats = wx.StaticText(self, label="Tokens: - | Custo Est.: -")
        footer_sizer.Add(self.lbl_stats, 1, wx.ALIGN_CENTER_VERTICAL)
        
        main_sizer.Add(footer_sizer, 0, wx.EXPAND | wx.ALL, 5)
        
        self.SetSizer(main_sizer)

    def set_default_image(self):
        # Placeholder cinza ou similar
        img = wx.Image(160, 90)
        img.Replace(0,0,0, 200,200,200) # Preenche cinza
        self.img_thumb.SetBitmap(wx.Bitmap(img))

    def load_video(self, video_data: dict, transcript_text: str):
        # Update Meta
        self.current_video_id = video_data.get('id')
        self.lbl_title.SetLabel(video_data.get('title', 'Unknown'))
        
        pl_title = video_data.get('playlist_title') or "Nenhuma"
        meta_text = f"ID: {self.current_video_id} | Playlist: {pl_title}\n"
        meta_text += f"Upload: {video_data.get('upload_date')} | Duração: {video_data.get('duration')}s"
        self.lbl_meta.SetLabel(meta_text)
        
        # Update Image
        thumb_path = video_data.get('thumbnail_path')
        if thumb_path and os.path.exists(thumb_path):
            try:
                # Tenta carregar ignorando erros de log do wx que poluem o console
                log_level = wx.Log.GetLogLevel()
                wx.Log.SetLogLevel(0) # Silencia temporariamente
                img = wx.Image(thumb_path, wx.BITMAP_TYPE_ANY)
                wx.Log.SetLogLevel(log_level) # Restaura log
                
                if img.IsOk():
                    img = img.Scale(160, 90, wx.IMAGE_QUALITY_HIGH)
                    self.img_thumb.SetBitmap(wx.Bitmap(img))
                else:
                    self.set_default_image()
            except:
                self.set_default_image()
        else:
            self.set_default_image()

        # [FASE 6] Prioridade: Resumo > Live Buffer > Transcrição
        summary_text = video_data.get('summary_text') or self.app_state._live_analysis_buffer.get(self.current_video_id)
        
        if summary_text:
            self._show_content("Resumo Inteligente", summary_text)
        else:
            self._show_content("Transcrição", transcript_text)

        # Update Stats
        t_count = video_data.get('token_count', 0)
        self.lbl_stats.SetLabel(f"Tokens: {t_count} (Estimado) | Saldo Sessão: ${self.app_state.get_session_budget():.2f}")

    def _show_content(self, title, text):
        if self.browser:
            html_content = markdown.markdown(text, extensions=['extra', 'codehilite'])
            styled_html = f"""
            <html>
            <head>
                <style>
                    body {{ font-family: 'Segoe UI', sans-serif; line-height: 1.6; padding: 20px; background-color: white; color: #282828; }}
                    h3 {{ color: {COLOR_ACCENT.GetAsString(wx.C2S_HTML_SYNTAX)}; border-bottom: 1px solid #eee; padding-bottom: 10px; }}
                </style>
            </head>
            <body>
            <h3>{title}</h3>
            <div>{html_content}</div>
            </body>
            </html>
            """
            self.browser.SetPage(styled_html, "")
        else:
            self.txt_content.SetValue(f"--- {title} ---\n\n{text}")

    # --- Handlers de Streaming (Sincronia Tab 2 <-> Tab 3) ---
    def on_summary_started(self, video_id):
        if video_id == self.current_video_id:
            wx.CallAfter(self._show_content, "Resumo Inteligente", "### ✨ Gerando resumo inteligente...")

    def on_summary_stream(self, video_id, text):
        if video_id == self.current_video_id:
            wx.CallAfter(self._show_content, "Resumo Inteligente", text)

    def on_summary_completed(self, video_id):
        if video_id == self.current_video_id:
            # Pega o vídeo atualizado do state para ter o resumo final processado
            v_meta = self.app_state.get_video(video_id)
            if v_meta:
                wx.CallAfter(self.load_video, v_meta, "")

    def Clear(self):
        self.current_video_id = None
        self.lbl_title.SetLabel("Selecione um vídeo")
        self.lbl_meta.SetLabel("")
        self.set_default_image()
        self._show_content("", "")
