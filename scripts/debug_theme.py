# scripts/debug_theme.py
"""
Diagnóstico visual de propagação de tema.
Executa varredura recursiva da árvore de widgets e reporta
quais componentes NÃO estão com as cores do tema ativo.

USO: Após alternar o tema, chame ThemeDebugger.audit(frame)
"""
import wx
import wx.grid
import logging

logger = logging.getLogger("contextflow.theme.debug")


class ThemeDebugger:
    """Ferramenta de auditoria de cores para debug de tema."""

    @staticmethod
    def audit(window: wx.Window, theme_manager=None, depth=0, parent_path=""):
        """
        Percorre recursivamente toda a árvore de widgets.
        Loga cada widget cujo BackgroundColour ou ForegroundColour
        diverge do esperado pelo tema.
        """
        if theme_manager is None:
            from core.managers.theme_manager import ThemeManager
            theme_manager = ThemeManager()

        expected_bg = theme_manager.get_bg_color()
        expected_fg = theme_manager.get_fg_color()
        is_dark = theme_manager.is_dark()

        indent = "  " * depth
        widget_name = window.__class__.__name__
        widget_id = f"{parent_path}/{widget_name}"

        # Pega cores atuais
        try:
            actual_bg = window.GetBackgroundColour()
            actual_fg = window.GetForegroundColour()
        except Exception:
            logger.debug(f"{indent}[SKIP] {widget_id} — não suporta GetBackgroundColour")
            return

        # Categorias de widgets que têm tratamento especial
        skip_types = (wx.grid.Grid,)  # Grid tem apply_grid_theme separado
        
        # [6.2c] Widgets nativos que NÃO aceitam cor no Windows
        native_skip = ('ToolBar', 'StatusBar', 'WebView', 'StaticBox')
        if widget_name in native_skip:
            logger.debug(f"{indent}[NATIVE-SKIP] {widget_id} — limitação Windows")
            return

        # [6.2c] TagWrapPanel chips — cores intencionais baseadas em hash
        if "TagWrapPanel" in widget_id and widget_name == "Panel" and depth > 0:
            logger.debug(f"{indent}[TAG-CHIP] {widget_id} — cor intencional")
            # Pula recursão nos filhos do chip também
            return

        # [6.2c] StaticBitmap com fundo preto — intencional (placeholder de thumbnail)
        if widget_name == 'StaticBitmap' and actual_bg == wx.Colour(0, 0, 0):
            logger.debug(f"{indent}[OK-INTENTIONAL] {widget_id} — StaticBitmap preto")
            return

        # Widgets que intencionalmente NÃO seguem o tema
        is_console = "ConsolePanel" in widget_id or "txt_log" in widget_id
        is_accent_btn = hasattr(window, 'GetLabel') and window.__class__.__name__ == 'Button'

        # Verifica divergência de Background
        bg_match = ThemeDebugger._colors_similar(actual_bg, expected_bg)
        fg_match = ThemeDebugger._colors_similar(actual_fg, expected_fg)

        if isinstance(window, skip_types):
            logger.debug(f"{indent}[GRID] {widget_id} — tratamento especial, pulando")
        elif is_console:
            console_bg = theme_manager.get_console_bg()
            console_match = ThemeDebugger._colors_similar(actual_bg, console_bg)
            if not console_match:
                logger.warning(
                    f"{indent}[CONSOLE-BG] {widget_id} — "
                    f"atual=({actual_bg.Red()},{actual_bg.Green()},{actual_bg.Blue()}) "
                    f"esperado=({console_bg.Red()},{console_bg.Green()},{console_bg.Blue()})"
                )
            else:
                logger.debug(f"{indent}[OK-CONSOLE] {widget_id}")
        else:
            if not bg_match:
                # Verifica se é um widget com cor intencional (highlight, accent, etc)
                is_highlight = ThemeDebugger._colors_similar(actual_bg, theme_manager.get_highlight_color())
                is_accent = ThemeDebugger._colors_similar(actual_bg, theme_manager.get_accent_color())
                is_input = ThemeDebugger._colors_similar(actual_bg, theme_manager.get_input_bg())
                is_grid_bg = ThemeDebugger._colors_similar(actual_bg, theme_manager.get_grid_bg())
                is_border = ThemeDebugger._colors_similar(actual_bg, theme_manager.get_border_color())
                is_white_btn = actual_bg == wx.Colour(255, 255, 255) and is_accent_btn

                # [6.2c] Cores hardcoded intencionais de botões (danger red, primary blue)
                hardcoded_btn_colors = [
                    wx.Colour(239, 68, 68),   # Red 500 — botão Abort/Cancel
                    wx.Colour(37, 99, 235),   # Blue 600 — botão Save/Primary
                    wx.Colour(200, 50, 50),   # Red — botão cancelar
                ]
                is_hardcoded_btn = any(
                    ThemeDebugger._colors_similar(actual_bg, hc) for hc in hardcoded_btn_colors
                )

                # [6.2c] Botões nativos Windows que rejeitam SetBackgroundColour
                is_native_btn = (widget_name == 'Button' and
                                 actual_bg == wx.Colour(240, 240, 240))
                
                if not any([is_highlight, is_accent, is_input, is_grid_bg,
                            is_border, is_white_btn, is_hardcoded_btn, is_native_btn]):
                    logger.warning(
                        f"{indent}[BG-DIVERGE] {widget_id} — "
                        f"atual=({actual_bg.Red()},{actual_bg.Green()},{actual_bg.Blue()}) "
                        f"esperado=({expected_bg.Red()},{expected_bg.Green()},{expected_bg.Blue()}) "
                        f"tipo={widget_name}"
                    )
                else:
                    logger.debug(f"{indent}[OK-SPECIAL] {widget_id}")
            else:
                logger.debug(f"{indent}[OK] {widget_id}")

            # Verifica Foreground apenas para widgets de texto
            if isinstance(window, (wx.StaticText, wx.TextCtrl, wx.CheckBox)):
                if not fg_match:
                    # Checa se é cor intencional (accent, muted, hardcoded)
                    is_accent_fg = ThemeDebugger._colors_similar(actual_fg, theme_manager.get_accent_color())
                    is_muted_fg = ThemeDebugger._colors_similar(actual_fg, theme_manager.get_muted_color())
                    is_hardcoded_grey = actual_fg == wx.Colour(100, 116, 139)
                    is_red = actual_fg.Red() > 180 and actual_fg.Green() < 100
                    is_green = actual_fg.Green() > 140 and actual_fg.Red() < 100
                    is_blue = actual_fg.Blue() > 180 and actual_fg.Red() < 100
                    is_white = actual_fg == wx.Colour(255, 255, 255)
                    
                    if not any([is_accent_fg, is_muted_fg, is_hardcoded_grey, 
                               is_red, is_green, is_blue, is_white]):
                        label_text = ""
                        try:
                            label_text = window.GetLabel()[:40] if hasattr(window, 'GetLabel') else ""
                        except Exception:
                            pass
                        logger.warning(
                            f"{indent}[FG-DIVERGE] {widget_id} — "
                            f"atual=({actual_fg.Red()},{actual_fg.Green()},{actual_fg.Blue()}) "
                            f"esperado=({expected_fg.Red()},{expected_fg.Green()},{expected_fg.Blue()}) "
                            f"label='{label_text}'"
                        )

        # Recursão nos filhos
        for child in window.GetChildren():
            ThemeDebugger.audit(child, theme_manager, depth + 1, widget_id)

    @staticmethod
    def _colors_similar(c1: wx.Colour, c2: wx.Colour, tolerance=15) -> bool:
        """Compara duas cores com tolerância para variações de renderização."""
        return (abs(c1.Red() - c2.Red()) <= tolerance and
                abs(c1.Green() - c2.Green()) <= tolerance and
                abs(c1.Blue() - c2.Blue()) <= tolerance)

    @staticmethod
    def summary(window: wx.Window, theme_manager=None):
        """Gera um resumo rápido: contagem de widgets OK vs divergentes."""
        if theme_manager is None:
            from core.managers.theme_manager import ThemeManager
            theme_manager = ThemeManager()

        stats = {"total": 0, "ok": 0, "bg_diverge": 0, "fg_diverge": 0, "skipped": 0}
        ThemeDebugger._count_recursive(window, theme_manager, stats)
        
        logger.info("=" * 60)
        logger.info("RESUMO DA AUDITORIA DE TEMA")
        logger.info(f"  Tema ativo: {theme_manager.get_theme_name()}")
        logger.info(f"  Total widgets: {stats['total']}")
        logger.info(f"  OK: {stats['ok']}")
        logger.info(f"  BG divergente: {stats['bg_diverge']}")
        logger.info(f"  FG divergente: {stats['fg_diverge']}")
        logger.info(f"  Pulados (Grid/especial): {stats['skipped']}")
        logger.info("=" * 60)
        
        return stats

    @staticmethod
    def _count_recursive(window, theme_manager, stats, parent_path=""):
        stats["total"] += 1
        widget_name = window.__class__.__name__
        
        if isinstance(window, wx.grid.Grid):
            stats["skipped"] += 1
        else:
            try:
                actual_bg = window.GetBackgroundColour()
                expected_bg = theme_manager.get_bg_color()
                if not ThemeDebugger._colors_similar(actual_bg, expected_bg):
                    # Checa cores válidas alternativas
                    valid_colors = [
                        theme_manager.get_highlight_color(),
                        theme_manager.get_accent_color(),
                        theme_manager.get_input_bg(),
                        theme_manager.get_grid_bg(),
                        theme_manager.get_border_color(),
                        theme_manager.get_console_bg(),
                        wx.Colour(239, 68, 68),   # Red 500 — botão Abort
                        wx.Colour(37, 99, 235),   # Blue 600 — botão Save
                        wx.Colour(200, 50, 50),   # Red — botão Cancel
                        wx.Colour(240, 240, 240),  # Native button fallback
                    ]
                    if not any(ThemeDebugger._colors_similar(actual_bg, vc) for vc in valid_colors):
                        stats["bg_diverge"] += 1
                    else:
                        stats["ok"] += 1
                else:
                    stats["ok"] += 1
            except Exception:
                stats["skipped"] += 1

        for child in window.GetChildren():
            ThemeDebugger._count_recursive(child, theme_manager, stats)
