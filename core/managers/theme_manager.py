# contextflow/core/managers/theme_manager.py
import wx
import logging

logger = logging.getLogger("contextflow.theme")

class ThemeManager:
    """
    Singleton que impõe o Light Mode Absoluto em todo o sistema.
    Assegura que as cores sejam centralizadas, eliminando hexadecimais espalhados.
    """
    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(ThemeManager, cls).__new__(cls)
            cls._instance._initialized = False
        return cls._instance

    def __init__(self):
        if self._initialized:
            return
        self._initialized = True
        
        # Cores Mandatórias (Light Mode Absoluto)
        self.COLOR_BG = wx.Colour(255, 255, 255)      # #FFFFFF
        self.COLOR_FG = wx.Colour(0, 0, 0)          # #000000
        self.COLOR_ACCENT = wx.Colour(0, 120, 215)  # Azul ContextFlow (v6.0)
        self.COLOR_HIGHLIGHT = wx.Colour(240, 240, 240) # Cinza claro para seleção/hover
        self.COLOR_BORDER = wx.Colour(220, 220, 220)    # Linhas de grade e bordas
        
        logger.info("ThemeManager: Light Mode Absoluto inicializado.")

    def get_bg_color(self) -> wx.Colour:
        return self.COLOR_BG

    def get_fg_color(self) -> wx.Colour:
        return self.COLOR_FG

    def get_accent_color(self) -> wx.Colour:
        return self.COLOR_ACCENT

    def get_border_color(self) -> wx.Colour:
        return self.COLOR_BORDER

    def apply_theme(self, window: wx.Window):
        """Aplica recursivamente o tema a um widget e seus filhos."""
        window.SetBackgroundColour(self.COLOR_BG)
        window.SetForegroundColour(self.COLOR_FG)
        
        for child in window.GetChildren():
            self.apply_theme(child)
        window.Refresh()
