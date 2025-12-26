
# contextflow/ui/panel_console.py
import wx
import datetime

class ConsolePanel(wx.Panel):
    def __init__(self, parent):
        super().__init__(parent)
        self._init_ui()

    def _init_ui(self):
        sizer = wx.BoxSizer(wx.VERTICAL)
        
        # Log Text Area
        # TE_READONLY = User cannot edit
        # TE_RICH2 = Allows some formatting (colors) if needed
        self.txt_log = wx.TextCtrl(self, style=wx.TE_MULTILINE | wx.TE_READONLY | wx.TE_RICH2)
        
        # Styling: Monospace font, dark background optional
        font = wx.Font(9, wx.FONTFAMILY_TELETYPE, wx.FONTSTYLE_NORMAL, wx.FONTWEIGHT_NORMAL)
        self.txt_log.SetFont(font)
        
        # Configurar cores básicas para parecer terminal (opcional, pode ser padrão do sistema)
        # self.txt_log.SetBackgroundColour("#1e1e1e")
        # self.txt_log.SetForegroundColour("#d4d4d4")
        
        sizer.Add(self.txt_log, 1, wx.EXPAND | wx.ALL, 0)
        self.SetSizer(sizer)

    def log(self, message: str, level: str = "INFO"):
        """
        Adiciona mensagem ao log.
        Pode ser chamado de threads (use wx.CallAfter no chamador ou garanta aqui).
        """
        # Garante execução na main thread
        if not wx.IsMainThread():
            wx.CallAfter(self.log, message, level)
            return

        timestamp = datetime.datetime.now().strftime("%H:%M:%S")
        formatted_msg = f"[{timestamp}] [{level}] {message}\n"
        
        self.txt_log.AppendText(formatted_msg)
