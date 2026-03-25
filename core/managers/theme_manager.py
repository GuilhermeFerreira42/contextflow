# contextflow/core/managers/theme_manager.py
import wx
import wx.grid
import logging

logger = logging.getLogger("contextflow.theme")


class ThemeManager:
    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(ThemeManager, cls).__new__(cls)
            cls._instance._initialized = False
        return cls._instance

    def __init__(self):
        if self._initialized:
            return
        from core.config_manager import ConfigManager
        self.config = ConfigManager()
        self._current_theme = self.config.get("ui", "theme", "light")

        self.PALETTES = {
            "light": {
                "bg": wx.Colour(255, 255, 255),
                "fg": wx.Colour(30, 30, 30),
                "accent": wx.Colour(0, 120, 215),
                "highlight": wx.Colour(240, 240, 240),
                "border": wx.Colour(220, 220, 220),
                "muted": wx.Colour(120, 120, 120),
                "grid_bg": wx.Colour(255, 255, 255),
                "grid_fg": wx.Colour(30, 30, 30),
                "grid_line": wx.Colour(220, 220, 220),
                "grid_label_bg": wx.Colour(245, 245, 245),
                "grid_label_fg": wx.Colour(30, 30, 30),
                "grid_selection_bg": wx.Colour(0, 120, 215),
                "grid_selection_fg": wx.Colour(255, 255, 255),
                "input_bg": wx.Colour(255, 255, 255),
                "input_fg": wx.Colour(30, 30, 30),
                "button_bg": wx.Colour(240, 240, 240),
                "button_fg": wx.Colour(30, 30, 30),
                "console_bg": wx.Colour(30, 30, 30),
                "console_fg": wx.Colour(212, 212, 212),
            },
            "dark": {
                "bg": wx.Colour(30, 30, 30),
                "fg": wx.Colour(220, 220, 220),
                "accent": wx.Colour(56, 142, 255),
                "highlight": wx.Colour(45, 45, 45),
                "border": wx.Colour(60, 60, 60),
                "muted": wx.Colour(140, 140, 140),
                "grid_bg": wx.Colour(35, 35, 35),
                "grid_fg": wx.Colour(220, 220, 220),
                "grid_line": wx.Colour(55, 55, 55),
                "grid_label_bg": wx.Colour(45, 45, 45),
                "grid_label_fg": wx.Colour(200, 200, 200),
                "grid_selection_bg": wx.Colour(56, 142, 255),
                "grid_selection_fg": wx.Colour(255, 255, 255),
                "input_bg": wx.Colour(45, 45, 45),
                "input_fg": wx.Colour(220, 220, 220),
                "button_bg": wx.Colour(55, 55, 55),
                "button_fg": wx.Colour(220, 220, 220),
                "console_bg": wx.Colour(20, 20, 20),
                "console_fg": wx.Colour(200, 200, 200),
            }
        }

        self._initialized = True
        logger.info(f"ThemeManager inicializado (Tema Atual: {self._current_theme})")

    def get_theme_name(self) -> str:
        return self._current_theme

    def is_dark(self) -> bool:
        return self._current_theme == "dark"

    def toggle_theme(self):
        new_theme = "dark" if self._current_theme == "light" else "light"
        self.set_theme(new_theme)

    def set_theme(self, name: str):
        if name not in self.PALETTES:
            return
        self._current_theme = name
        self.config.set("ui", "theme", name)
        from core.pubsub import PubSub
        PubSub.publish("THEME_CHANGED", theme=name)
        logger.info(f"Tema alterado para: {name}")

    def _get_color(self, key: str) -> wx.Colour:
        return self.PALETTES[self._current_theme].get(key, wx.BLACK)

    def get_bg_color(self) -> wx.Colour: return self._get_color("bg")
    def get_fg_color(self) -> wx.Colour: return self._get_color("fg")
    def get_accent_color(self) -> wx.Colour: return self._get_color("accent")
    def get_border_color(self) -> wx.Colour: return self._get_color("border")
    def get_highlight_color(self) -> wx.Colour: return self._get_color("highlight")
    def get_muted_color(self) -> wx.Colour: return self._get_color("muted")
    def get_grid_bg(self) -> wx.Colour: return self._get_color("grid_bg")
    def get_grid_fg(self) -> wx.Colour: return self._get_color("grid_fg")
    def get_grid_line(self) -> wx.Colour: return self._get_color("grid_line")
    def get_grid_label_bg(self) -> wx.Colour: return self._get_color("grid_label_bg")
    def get_grid_label_fg(self) -> wx.Colour: return self._get_color("grid_label_fg")
    def get_grid_selection_bg(self) -> wx.Colour: return self._get_color("grid_selection_bg")
    def get_grid_selection_fg(self) -> wx.Colour: return self._get_color("grid_selection_fg")
    def get_input_bg(self) -> wx.Colour: return self._get_color("input_bg")
    def get_input_fg(self) -> wx.Colour: return self._get_color("input_fg")
    def get_console_bg(self) -> wx.Colour: return self._get_color("console_bg")
    def get_console_fg(self) -> wx.Colour: return self._get_color("console_fg")

    def css_color(self, key: str) -> str:
        c = self._get_color(key)
        return c.GetAsString(wx.C2S_HTML_SYNTAX)

    def apply_theme(self, window: wx.Window):
        """Aplica o tema NÃO recursivamente. Delega para componentes com apply_theme próprio."""
        # ESTRATÉGIA: NÃO faz recursão genérica.
        # Cada componente de alto nível (tab_analysis, sidebar, etc.) tem apply_theme() próprio
        # que sabe exatamente quais sub-widgets precisa atualizar.
        # A recursão genérica causa problemas porque:
        # 1. Não sabe quais widgets têm cores hardcoded intencionais
        # 2. Corrompe estado ao voltar para light
        # 3. wx.grid.Grid precisa de tratamento especial
        try:
            if hasattr(window, "apply_theme"):
                window.apply_theme()
            else:
                window.SetBackgroundColour(self.get_bg_color())
                window.SetForegroundColour(self.get_fg_color())
                window.Refresh()
        except Exception as e:
            logger.debug(f"apply_theme skip: {e}")

    def apply_grid_theme(self, grid: wx.grid.Grid):
        """Aplica tema especificamente para wx.grid.Grid."""
        try:
            grid.SetDefaultCellBackgroundColour(self.get_grid_bg())
            grid.SetDefaultCellTextColour(self.get_grid_fg())
            grid.SetGridLineColour(self.get_grid_line())
            grid.SetLabelBackgroundColour(self.get_grid_label_bg())
            grid.SetLabelTextColour(self.get_grid_label_fg())
            grid.SetSelectionBackground(self.get_grid_selection_bg())
            grid.SetSelectionForeground(self.get_grid_selection_fg())
            grid_window = grid.GetGridWindow()
            if grid_window:
                grid_window.SetBackgroundColour(self.get_grid_bg())
            corner = grid.GetGridCornerLabelWindow()
            if corner:
                corner.SetBackgroundColour(self.get_grid_label_bg())
            row_label = grid.GetGridRowLabelWindow()
            if row_label:
                row_label.SetBackgroundColour(self.get_grid_label_bg())
            col_label = grid.GetGridColLabelWindow()
            if col_label:
                col_label.SetBackgroundColour(self.get_grid_label_bg())
            grid.ForceRefresh()
        except Exception as e:
            logger.debug(f"apply_grid_theme error: {e}")

    def apply_to_button(self, button, role="default"):
        """
        Aplica tema a um botão, tentando GenButton primeiro, fallback para nativo.
        
        Args:
            button: wx.Button ou GenButton
            role: "default", "accent", "danger", "cancel"
        """
        palette = {
            "default": (self.get_highlight_color(), self.get_fg_color()),
            "accent": (self.get_accent_color(), wx.WHITE),
            "danger": (wx.Colour(220, 53, 69), wx.WHITE),
            "cancel": (self.get_highlight_color(), wx.Colour(200, 50, 50)),
        }
        
        bg, fg = palette.get(role, palette["default"])
        
        try:
            button.SetBackgroundColour(bg)
            button.SetForegroundColour(fg)
            # GenButton precisa recalcular sombras
            if hasattr(button, 'InitColours'):
                button.InitColours()
            button.Refresh()
        except Exception:
            pass
