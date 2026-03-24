# contextflow/ui/panel_console.py
import wx
import datetime
import logging
from core.managers.theme_manager import ThemeManager

class ConsolePanel(wx.Panel):
    def __init__(self, parent):
        super().__init__(parent)
        self.theme = ThemeManager()
        self._init_ui()

    def _init_ui(self):
        sizer = wx.BoxSizer(wx.VERTICAL)
        
        self.txt_log = wx.TextCtrl(self, style=wx.TE_MULTILINE | wx.TE_READONLY | wx.TE_RICH2)
        font = wx.Font(9, wx.FONTFAMILY_TELETYPE, wx.FONTSTYLE_NORMAL, wx.FONTWEIGHT_NORMAL)
        self.txt_log.SetFont(font)
        
        # Console sempre estilo terminal
        self.txt_log.SetBackgroundColour(self.theme.get_console_bg())
        self.txt_log.SetForegroundColour(self.theme.get_console_fg())
        
        sizer.Add(self.txt_log, 1, wx.EXPAND | wx.ALL, 0)
        self.SetSizer(sizer)

    def apply_theme(self):
        """[FASE 6.2] Atualiza cores do console (Terminal Style)."""
        self.theme = ThemeManager()
        # Console SEMPRE usa estilo terminal (fundo escuro)
        self.SetBackgroundColour(self.theme.get_console_bg())
        self.txt_log.SetBackgroundColour(self.theme.get_console_bg())
        self.txt_log.SetForegroundColour(self.theme.get_console_fg())
        self.txt_log.SetDefaultStyle(wx.TextAttr(self.theme.get_console_fg()))
        self.Refresh()

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
        self.txt_log.SetDefaultStyle(wx.TextAttr(self.theme.get_console_fg()))


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
                color = wx.Colour(49, 130, 206)
                if level == "ERROR" or level == "CRITICAL":
                    color = wx.Colour(229, 62, 62) # Red
                elif level == "WARNING":
                    color = wx.Colour(221, 107, 32) # Orange
                
                self.text_ctrl.SetDefaultStyle(wx.TextAttr(color))
                self.text_ctrl.AppendText(msg)
                theme = ThemeManager()
                self.text_ctrl.SetDefaultStyle(wx.TextAttr(theme.get_console_fg()))
        except:
            pass
