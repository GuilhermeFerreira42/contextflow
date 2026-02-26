
# contextflow/main.py
import wx
import sys
import os

# Adiciona o diretório atual ao path para imports funcionarem corretamente
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from ui.app_window import AppWindow
import core.token_engine

class ContextFlowApp(wx.App):
    def OnInit(self):
        print(f"Iniciando ContextFlow...")
        tik_ok = getattr(core.token_engine, 'TIKTOKEN_AVAILABLE', False)
        print(f"Ambiente: wxpython={wx.version()}, tiktoken={'OK' if tik_ok else 'FAIL'}")

        self.frame = AppWindow(None)
        self.SetTopWindow(self.frame)

        # --- Logging Setup ---
        import logging
        from ui.panel_console import WxLogHandler
        
        root_logger = logging.getLogger()
        root_logger.setLevel(logging.INFO)
        
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
