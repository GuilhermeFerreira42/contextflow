
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
        # [DIAGNÓSTICO] Verifica TIKTOKEN_AVAILABLE na inicialização.
        # Se falhar, o sistema avisa que operará em modo de estimativa de custos (fallback).
        print(f"Ambiente: wxpython={wx.version()}, tiktoken={'OK' if TIKTOKEN_AVAILABLE else 'FAIL'}")

        
        self.frame = AppWindow(None)
        self.SetTopWindow(self.frame)

        # --- Logging Setup ---
        import logging
        from ui.panel_console import WxLogHandler
        
        # Pega o logger raiz
        root_logger = logging.getLogger()
        root_logger.setLevel(logging.INFO)
        
        # Cria o handler apontando para o TextCtrl do Console
        # AppWindow -> panel_console -> txt_log
        if hasattr(self.frame, 'panel_console'):
            handler = WxLogHandler(self.frame.panel_console.txt_log)
            
            # Formatter simples
            formatter = logging.Formatter('%(asctime)s [%(levelname)s] %(name)s: %(message)s', datefmt='%H:%M:%S')
            handler.setFormatter(formatter)
            
            root_logger.addHandler(handler)
            logging.info("Logging system initialized and connected to GUI.")

        return True

if __name__ == '__main__':
    app = ContextFlowApp(False)
    app.MainLoop()
