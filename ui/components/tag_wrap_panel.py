"""
Painel de tags com layout flow/wrap para exibição completa.
[FASE 6.2] Componente extraído para manter tab_analysis.py < 700 linhas.
"""
import wx
import hashlib
import colorsys
from core.managers.theme_manager import ThemeManager


class TagWrapPanel(wx.Panel):
    """
    Exibe tags como chips coloridos com layout wrap.
    Usado no viewer lateral da Aba 2 para mostrar TODAS as tags,
    diferente da grid que mostra no máximo 2.
    """

    def __init__(self, parent):
        super().__init__(parent)
        self.theme = ThemeManager()
        self.SetBackgroundColour(self.theme.get_bg_color())
        self._tags = []
        self._chip_panels = []

        self._sizer = wx.WrapSizer(wx.HORIZONTAL)
        self.SetSizer(self._sizer)

    def set_tags(self, tags: list):
        """
        Atualiza as tags exibidas.
        Destrói chips antigos e cria novos.

        Args:
            tags: Lista de strings com nomes das tags
        """
        self._tags = tags or []

        # Limpa chips existentes
        for chip in self._chip_panels:
            chip.Destroy()
        self._chip_panels.clear()
        self._sizer.Clear(delete_windows=False)

        if not self._tags:
            lbl = wx.StaticText(self, label="Sem tags")
            lbl.SetFont(wx.Font(8, wx.FONTFAMILY_DEFAULT,
                                wx.FONTSTYLE_ITALIC, wx.FONTWEIGHT_NORMAL))
            lbl.SetForegroundColour(self.theme.get_muted_color())
            self._sizer.Add(lbl, 0, wx.ALL, 2)
            self._chip_panels.append(lbl)
        else:
            for tag in self._tags:
                chip = self._create_chip(tag)
                self._sizer.Add(chip, 0, wx.RIGHT | wx.BOTTOM, 4)
                self._chip_panels.append(chip)

        self.Layout()
        self.GetParent().Layout()

    def _create_chip(self, tag_name: str) -> wx.Panel:
        """Cria um chip individual com cor baseada em hash."""
        chip = wx.Panel(self)
        bg_color = self._get_tag_color(tag_name)
        chip.SetBackgroundColour(bg_color)

        lbl = wx.StaticText(chip, label=f" {tag_name} ")
        lbl.SetFont(wx.Font(8, wx.FONTFAMILY_DEFAULT,
                            wx.FONTSTYLE_NORMAL, wx.FONTWEIGHT_NORMAL))

        # Contraste automático de texto
        lbl.SetForegroundColour(self._contrast_text(bg_color))

        sizer = wx.BoxSizer(wx.HORIZONTAL)
        sizer.Add(lbl, 0, wx.ALL, 2)
        chip.SetSizer(sizer)
        chip.Fit()

        return chip

    def _get_tag_color(self, name: str) -> wx.Colour:
        """Gera uma cor pastel estável baseada no hash do nome."""
        h = int(hashlib.md5(name.encode()).hexdigest(), 16) % 360
        if self.theme.is_dark():
            r, g, b = colorsys.hls_to_rgb(h / 360.0, 0.35, 0.5)
        else:
            r, g, b = colorsys.hls_to_rgb(h / 360.0, 0.85, 0.45)
        return wx.Colour(int(r * 255), int(g * 255), int(b * 255))

    @staticmethod
    def _contrast_text(bg: wx.Colour) -> wx.Colour:
        """Retorna preto ou branco conforme luminância do fundo."""
        luminance = (0.299 * bg.Red() + 0.587 * bg.Green() + 0.114 * bg.Blue())
        return wx.Colour(40, 40, 40) if luminance > 160 else wx.Colour(245, 245, 245)

    def apply_theme(self):
        """Reaplica cores do tema atual."""
        self.theme = ThemeManager()
        self.SetBackgroundColour(self.theme.get_bg_color())
        # Recria chips com cores atualizadas
        self.set_tags(self._tags)
