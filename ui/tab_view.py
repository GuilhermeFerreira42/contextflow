
# contextflow/ui/tab_view.py
import wx
import os

class ViewTab(wx.Panel):
    def __init__(self, parent):
        super().__init__(parent)
        self._init_ui()

    def _init_ui(self):
        sizer = wx.BoxSizer(wx.VERTICAL)
        
        # Header Info
        self.lbl_title = wx.StaticText(self, label="Nenhum vídeo selecionado")
        font = wx.Font(14, wx.FONTFAMILY_DEFAULT, wx.FONTSTYLE_NORMAL, wx.FONTWEIGHT_BOLD)
        self.lbl_title.SetFont(font)
        sizer.Add(self.lbl_title, 0, wx.ALL, 10)
        
        # Details
        grid = wx.FlexGridSizer(2, 2, 5, 10)
        grid.Add(wx.StaticText(self, label="ID:"), 0, wx.FONTWEIGHT_BOLD)
        self.lbl_id = wx.StaticText(self, label="-")
        grid.Add(self.lbl_id, 1)
        
        grid.Add(wx.StaticText(self, label="Tokens:"), 0, wx.FONTWEIGHT_BOLD)
        self.lbl_tokens = wx.StaticText(self, label="-")
        grid.Add(self.lbl_tokens, 1)
        
        sizer.Add(grid, 0, wx.LEFT | wx.BOTTOM, 10)
        
        # Content Area
        self.txt_content = wx.TextCtrl(self, style=wx.TE_MULTILINE | wx.TE_READONLY | wx.TE_RICH2)
        # Font Monospaced pra código/texto bruto
        self.txt_content.SetFont(wx.Font(10, wx.FONTFAMILY_TELETYPE, wx.FONTSTYLE_NORMAL, wx.FONTWEIGHT_NORMAL))
        
        sizer.Add(self.txt_content, 1, wx.EXPAND | wx.ALL, 5)
        
        self.SetSizer(sizer)

    def load_video(self, video_data: dict, transcript_text: str):
        self.lbl_title.SetLabel(video_data.get('title', 'Unknown'))
        self.lbl_id.SetLabel(video_data.get('id', '-'))
        self.lbl_tokens.SetLabel(str(video_data.get('token_count', 0)))
        
        self.txt_content.SetValue(transcript_text)
