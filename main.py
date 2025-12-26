
# contextflow/main.py
import wx
import sys
import os

# Adiciona o diretório atual ao path para imports funcionarem corretamente
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from ui.app_window import AppWindow
from core.token_engine import TIKTOKEN_AVAILABLE

class ContextFlowApp(wx.App):
    def OnInit(self):
        print(f"Iniciando ContextFlow...")
        print(f"Ambiente: wxpython={wx.version()}, tiktoken={'OK' if TIKTOKEN_AVAILABLE else 'FAIL'}")
        
        self.frame = AppWindow(None)
        self.SetTopWindow(self.frame)
        return True

if __name__ == '__main__':
    app = ContextFlowApp(False)
    app.MainLoop()
