
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
        Adiciona mensagem ao log com coloração semântica.
        """
        if not wx.IsMainThread():
            wx.CallAfter(self.log, message, level)
            return

        timestamp = datetime.datetime.now().strftime("%H:%M:%S")
        formatted_msg = f"[{timestamp}] [{level}] {message}\n"
        
        # [QA4] Coloração Sintática (Semantic Logging)
        color = wx.Colour(49, 130, 206) # Default Blue (Info)
        if level == "ERROR":
            color = wx.Colour(229, 62, 62) # Red
        elif level == "WARNING":
            color = wx.Colour(221, 107, 32) # Orange
        elif level == "SYSTEM":
            color = wx.Colour(49, 130, 206) # Blue
            
        self.txt_log.SetDefaultStyle(wx.TextAttr(color))
        self.txt_log.AppendText(formatted_msg)
        # Reseta estilo para não vazar
        self.txt_log.SetDefaultStyle(wx.TextAttr(wx.BLACK))

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
        level = record.levelname
        if level == "INFO" and "SYSTEM" in msg.upper():
            level = "SYSTEM"
            
        if wx.GetApp():
             wx.CallAfter(self._write, msg + "\n", level)

    def _write(self, msg, level):
        try:
            if self.text_ctrl:
                # [QA4] Usa a lógica de cor do painel
                # Como o handler recebe o TextCtrl direto, vamos tentar achar o objeto ConsolePanel se possível
                # ou apenas aplicar o estilo aqui.
                # Mas ConsolePanel.log faz mais sentido. 
                # O handler foi inicializado com self.txt_log (TextCtrl).
                
                # Vamos injetar o painel no handler ou usar uma lógica de cores aqui
                color = wx.Colour(49, 130, 206)
                if level == "ERROR" or level == "CRITICAL":
                    color = wx.Colour(229, 62, 62) # Red
                elif level == "WARNING":
                    color = wx.Colour(221, 107, 32) # Orange
                
                self.text_ctrl.SetDefaultStyle(wx.TextAttr(color))
                self.text_ctrl.AppendText(msg)
                self.text_ctrl.SetDefaultStyle(wx.TextAttr(wx.BLACK))
        except:
            pass
