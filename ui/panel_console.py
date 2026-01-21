
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

import logging
class WxLogHandler(logging.Handler):
    """
    Handler customizado do logging que escreve no TextCtrl da GUI.
    """
    def __init__(self, text_ctrl):
        super().__init__()
        self.text_ctrl = text_ctrl
        
    def emit(self, record):
        msg = self.format(record)
        # Garante que vai para a main thread
        if wx.GetApp():
             # Precisa acessar o método log do painel pai OU escrever direto?
             # Vamos escrever direto ou chamar log?
             # O log method do ConsolePanel formata de novo.
             # Vamos chamar direto o append para evitar duplo timestamp se o formatter padrão já tiver.
             # Mas aqui vamos usar o Panel.log para consistência se possível, 
             # mas Panel.log espera mensagem crua.
             # Vamos extrair a mensagem e chamar ConsolePanel.log
             
             # Melhor: Vamos fazer o handler escrever direto, já formatado pelo logging system
             wx.CallAfter(self._write, msg + "\n")

    def _write(self, msg):
        try:
            if self.text_ctrl:
                self.text_ctrl.AppendText(msg)
        except:
            pass
