# contextflow/core/theme_manager.py
import wx
import logging

logger = logging.getLogger("contextflow.theme")

class ThemeManager:
    """
    Soberania Estética (Fase 6.1.1).
    Centraliza a definição de cores e estilos para garantir o padrão Light Mode Premium.
    Elimina o uso de hexadecimais espalhados pelo código.
    """
    
    # --- PALETA DE CORES (SSoT) ---
    COLOR_BG = wx.Colour(255, 255, 255)       # Branco Absoluto
    COLOR_FG = wx.Colour(45, 45, 45)          # Grafite para contraste
    COLOR_ACCENT = wx.Colour(0, 120, 215)     # Azul Windows Moderno
    COLOR_SECONDARY = wx.Colour(240, 240, 240) # Cinza suave para fundos de controle
    COLOR_BORDER = wx.Colour(220, 220, 220)    # Borda discreta
    COLOR_HIGHLIGHT = wx.Colour(230, 243, 255) # Azul claríssimo para seleção
    COLOR_WARNING = wx.Colour(200, 50, 50)     # Vermelho para alertas
    COLOR_SUCCESS = wx.Colour(34, 139, 34)     # Verde para sucesso/✅
    
    _instance = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(ThemeManager, cls).__new__(cls)
            cls._instance._initialized = False
        return cls._instance

    def __init__(self):
        if self._initialized: return
        self._initialized = True
        logger.info("ThemeManager (Light Mode Absolute) inicializado.")

    @classmethod
    def apply_theme(cls, window: wx.Window):
        """Aplica as cores base a um componente wxPython."""
        window.SetBackgroundColour(cls.COLOR_BG)
        window.SetForegroundColour(cls.COLOR_FG)

    @classmethod
    def get_webview_css(cls) -> str:
        """Retorna o CSS injetável para o WebView garantir o modo claro."""
        accent_hex = cls.COLOR_ACCENT.GetAsString(wx.C2S_HTML_SYNTAX)
        return f"""
        body {{
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            background-color: white !important;
            color: #2D2D2D !important;
            line-height: 1.6;
            margin: 0;
            padding: 24px;
        }}
        h1, h2, h3, h4 {{
            color: {accent_hex};
            margin-top: 1.5em;
        }}
        pre {{
            background: #F8F9FA;
            padding: 16px;
            border-radius: 8px;
            border: 1px solid #E9ECEF;
            overflow-x: auto;
        }}
        code {{
            font-family: 'Cascadia Code', 'Fira Code', 'Consolas', monospace;
            background: #F1F3F5;
            padding: 2px 4px;
            border-radius: 4px;
        }}
        blockquote {{
            border-left: 4px solid {accent_hex};
            margin-left: 0;
            padding-left: 16px;
            color: #616161;
            font-style: italic;
        }}
        table {{
            border-collapse: collapse;
            width: 100%;
            margin: 20px 0;
        }}
        th, td {{
            border: 1px solid #DEE2E6;
            padding: 12px;
            text-align: left;
        }}
        th {{
            background-color: #F8F9FA;
        }}
        """

    @classmethod
    def get_color(cls, name: str) -> wx.Colour:
        """Retorna uma cor por nome (convenitência para RFs)."""
        return getattr(cls, f"COLOR_{name.upper()}", cls.COLOR_FG)
