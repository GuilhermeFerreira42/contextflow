
# contextflow/ui/panel_detail.py
import wx
import wx.html2
import os
from constants import THUMBNAILS_DIR
from core.managers.theme_manager import ThemeManager

class DetailPanel(wx.Panel):
    def __init__(self, parent):
        super().__init__(parent)
        self.theme = ThemeManager()
        self.SetBackgroundColour(self.theme.get_bg_color())
        self.SetForegroundColour(self.theme.get_fg_color())
        self._init_ui()

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
            # [6.2d] Evita Flash: Injeta fundo do tema ativo imediatamente
            bg_hex = self.theme.get_bg_color().GetAsString(wx.C2S_HTML_SYNTAX)
            self.browser.SetPage(f"<html><body style='background-color:{bg_hex};'></body></html>", "")
            main_sizer.Add(self.browser, 1, wx.EXPAND | wx.ALL, 0)
        else:
            self.txt_content = wx.TextCtrl(self, style=wx.TE_MULTILINE | wx.TE_READONLY | wx.NO_BORDER)
            self.txt_content.SetBackgroundColour(self.theme.get_bg_color())  # [6.2d]
            self.txt_content.SetForegroundColour(self.theme.get_fg_color())  # [6.2d]
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
        self.lbl_title.SetLabel(video_data.get('title', 'Unknown'))
        
        pl_title = video_data.get('playlist_title') or "Nenhuma"
        meta_text = f"ID: {video_data.get('id')} | Playlist: {pl_title}\n"
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
                    print(f"Erro: Imagem inválida ou corrompida: {thumb_path}")
                    self.set_default_image()
            except Exception as e:
                print(f"Erro ao carregar thumbnail {thumb_path}: {e}")
                self.set_default_image()
        else:
            self.set_default_image()

        # Update Content
        # Formatando texto para HTML simples para leitura agradável (Multi-Theme)
        bg_hex = self.theme.get_bg_color().GetAsString(wx.C2S_HTML_SYNTAX)
        fg_hex = self.theme.get_fg_color().GetAsString(wx.C2S_HTML_SYNTAX)
        accent_hex = self.theme.get_accent_color().GetAsString(wx.C2S_HTML_SYNTAX)
        border_hex = self.theme.get_border_color().GetAsString(wx.C2S_HTML_SYNTAX)

        if self.browser:
            html_content = f"""
            <html>
            <head>
                <style>
                    body {{
                        font-family: 'Segoe UI', sans-serif;
                        line-height: 1.6;
                        padding: 20px;
                        background-color: {bg_hex};
                        color: {fg_hex};
                        margin: 0;
                    }}
                    h3 {{ color: {accent_hex}; border-bottom: 1px solid {border_hex}; padding-bottom: 10px; }}
                    p {{ white-space: pre-wrap; }}
                </style>
            </head>
            <body>
            <h3>Transcrição</h3>
            <p>{transcript_text}</p>
            </body>
            </html>
            """
            self.browser.SetPage(html_content, "")
        else:
            self.txt_content.SetValue(transcript_text)

        # Update Stats
        t_count = video_data.get('token_count', 0)
        self.lbl_stats.SetLabel(f"Tokens: {t_count} (Estimado)")

    def apply_theme(self):
        """[FASE 6.2c] Atualiza cores do DetailPanel e WebView."""
        self.theme = ThemeManager()
        bg = self.theme.get_bg_color()
        fg = self.theme.get_fg_color()

        self.SetBackgroundColour(bg)
        self.SetForegroundColour(fg)

        # [6.2c] Labels — BG + FG
        if hasattr(self, 'lbl_title'):
            self.lbl_title.SetBackgroundColour(bg)
            self.lbl_title.SetForegroundColour(fg)
        if hasattr(self, 'lbl_meta'):
            self.lbl_meta.SetBackgroundColour(bg)
            self.lbl_meta.SetForegroundColour(fg)
        if hasattr(self, 'lbl_stats'):
            self.lbl_stats.SetBackgroundColour(bg)
            self.lbl_stats.SetForegroundColour(fg)

        # [6.2c] Thumbnail placeholder — precisa de BG explícito
        if hasattr(self, 'img_thumb'):
            self.img_thumb.SetBackgroundColour(bg)

        # WebView — injeta CSS via JavaScript
        # [6.2d] Só executa JS se houver página carregada (evita erro de init)
        if self.browser:
            current_url = ""
            try:
                current_url = self.browser.GetCurrentURL()
            except Exception:
                pass
            if current_url and current_url not in ("", "about:blank"):
                bg_hex = bg.GetAsString(wx.C2S_HTML_SYNTAX)
                fg_hex = fg.GetAsString(wx.C2S_HTML_SYNTAX)
                js = f"document.body.style.backgroundColor='{bg_hex}';"
                js += f"document.body.style.color='{fg_hex}';"
                try:
                    self.browser.RunScript(js)
                except Exception:
                    pass
        elif hasattr(self, "txt_content"):
            self.txt_content.SetBackgroundColour(bg)
            self.txt_content.SetForegroundColour(fg)

        self.Refresh()
