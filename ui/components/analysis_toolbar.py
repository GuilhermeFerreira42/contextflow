# contextflow/ui/components/analysis_toolbar.py
import wx
from core.pubsub import PubSub
from core.managers.theme_manager import ThemeManager

class AnalysisToolbar(wx.Panel):
    """
    Componente segregado para a Toolbar do Cockpit Analítico.
    [ZERO KNOWLEDGE] Gerencia seletores de IA e ações de lote.
    """
    def __init__(self, parent, app_state):
        super().__init__(parent)
        self.app_state = app_state
        self.theme = ThemeManager()
        self.SetBackgroundColour(self.theme.get_bg_color())
        
        self._ai_models_cache = []
        self._init_ui()
        self._bind_events()
        
        # Popula inicial
        wx.CallAfter(self.populate_model_selector)

    def _init_ui(self):
        self.SetMinSize((-1, 40))
        tb_sizer = wx.BoxSizer(wx.HORIZONTAL)

        # Botão Batch Summarize
        self.btn_summarize = wx.Button(self, label="✨ Resumir Selecionados")
        self.btn_summarize.SetBackgroundColour(self.theme.get_accent_color())
        self.btn_summarize.SetForegroundColour(wx.WHITE)
        self.btn_summarize.SetFont(wx.Font(9, wx.FONTFAMILY_DEFAULT,
                                           wx.FONTSTYLE_NORMAL, wx.FONTWEIGHT_BOLD))

        # Separador visual
        sep1 = wx.StaticLine(self, style=wx.LI_VERTICAL)

        # Seletor de Provedor
        lbl_provider = wx.StaticText(self, label="IA:")
        lbl_provider.SetFont(wx.Font(8, wx.FONTFAMILY_DEFAULT,
                                     wx.FONTSTYLE_NORMAL, wx.FONTWEIGHT_BOLD))
        lbl_provider.SetForegroundColour(self.theme.get_fg_color())  # [6.2d]
        self.choice_provider = wx.Choice(self, choices=["ollama", "google"],
                                         size=(90, -1))
        
        current_provider = self.app_state.config.get("orchestration", "active_provider", "ollama")
        idx_p = self.choice_provider.FindString(current_provider)
        self.choice_provider.SetSelection(idx_p if idx_p != wx.NOT_FOUND else 0)

        # Seletor de Modelo
        self.choice_model = wx.Choice(self, choices=["Carregando..."], size=(200, -1))
        self.choice_model.SetSelection(0)
        self.choice_model.Enable(False)

        # Botão de refresh
        self.btn_refresh_models = wx.Button(self, label="🔄", size=(30, -1), style=wx.BU_EXACTFIT)
        self.btn_refresh_models.SetToolTip("Atualizar lista de modelos")

        # Status
        self.lbl_ai_status = wx.StaticText(self, label="")
        self.lbl_ai_status.SetFont(wx.Font(8, wx.FONTFAMILY_DEFAULT,
                                           wx.FONTSTYLE_NORMAL, wx.FONTWEIGHT_NORMAL))
        self.lbl_ai_status.SetForegroundColour(self.theme.get_fg_color())  # [6.2d]

        # Outras ações
        self.btn_export = wx.Button(self, label="📁 Export ZIP/MD")
        self.btn_export.SetBackgroundColour(self.theme.get_highlight_color())  # [6.2d]
        self.btn_export.SetForegroundColour(self.theme.get_fg_color())  # [6.2d]
        
        self.btn_cancel = wx.Button(self, label="🛑 Cancelar")
        self.btn_cancel.SetForegroundColour(wx.Colour(200, 50, 50))

        self.search = wx.SearchCtrl(self)
        self.search.SetDescriptiveText("Filtro rápido...")
        self.search.ShowCancelButton(True)

        # Layout
        tb_sizer.Add(self.btn_summarize, 0, wx.CENTER | wx.LEFT, 10)
        tb_sizer.Add(sep1, 0, wx.EXPAND | wx.LEFT | wx.RIGHT, 8)
        tb_sizer.Add(lbl_provider, 0, wx.CENTER | wx.LEFT, 5)
        tb_sizer.Add(self.choice_provider, 0, wx.CENTER | wx.LEFT, 3)
        tb_sizer.Add(self.choice_model, 0, wx.CENTER | wx.LEFT, 5)
        tb_sizer.Add(self.btn_refresh_models, 0, wx.CENTER | wx.LEFT, 2)
        tb_sizer.Add(self.lbl_ai_status, 0, wx.CENTER | wx.LEFT, 8)
        tb_sizer.AddStretchSpacer()
        tb_sizer.Add(self.btn_export, 0, wx.CENTER | wx.LEFT, 5)
        tb_sizer.Add(self.btn_cancel, 0, wx.CENTER | wx.LEFT, 5)
        tb_sizer.Add(self.search, 0, wx.CENTER | wx.RIGHT, 10)

        self.SetSizer(tb_sizer)

    def _bind_events(self):
        self.choice_provider.Bind(wx.EVT_CHOICE, self._on_provider_changed)
        self.choice_model.Bind(wx.EVT_CHOICE, self._on_model_changed)
        self.btn_refresh_models.Bind(wx.EVT_BUTTON, self._on_refresh_click)

    def _on_refresh_click(self, event):
        """Dispara refresh manual ignorando cache TTL."""
        self.populate_model_selector(force_refresh=True)

    def populate_model_selector(self, force_refresh: bool = False):
        provider = self.choice_provider.GetStringSelection()
        self.lbl_ai_status.SetLabel("🔍 Buscando modelos...")
        self.choice_model.Enable(False)

        self.app_state.discover_ai_models(
            provider=provider, 
            callback=self.on_models_discovered,
            force_refresh=force_refresh
        )

    def on_models_discovered(self, models):
        """
        [BISTURI-OLLAMA] Callback central para descoberta de modelos.
        Garante Thread Safety via wx.CallAfter (embora AppState já o faça).
        """
        wx.CallAfter(self._update_model_selector, models)

    def _update_model_selector(self, models):
        self._ai_models_cache = models
        if not models:
            self.choice_model.SetItems(["Nenhum modelo disponível"])
            self.choice_model.SetSelection(0)
            self.choice_model.Enable(False)
            self.lbl_ai_status.SetLabel("⚠️ Provider indisponível")
            self.lbl_ai_status.SetForegroundColour(wx.Colour(220, 53, 69))
            return

        model_names = [m["name"] for m in models]
        self.choice_model.SetItems(model_names)
        self.choice_model.Enable(True)

        current_prov = self.choice_provider.GetStringSelection()
        configured_model = self.app_state.config.get(current_prov, "model", "")
        idx = self.choice_model.FindString(configured_model)
        self.choice_model.SetSelection(idx if idx != wx.NOT_FOUND else 0)
        
        self.lbl_ai_status.SetLabel(f"✅ {len(models)} modelos prontos")
        self.lbl_ai_status.SetForegroundColour(wx.Colour(22, 163, 74))

    def _on_provider_changed(self, event):
        selected = self.choice_provider.GetStringSelection()
        self.app_state.config.set("orchestration", "active_provider", selected)
        self.populate_model_selector()

    def _on_model_changed(self, event):
        selected = self.choice_model.GetStringSelection()
        if selected and selected not in ["Nenhum modelo disponível", "Carregando..."]:
            provider = self.choice_provider.GetStringSelection()
            # [QA] Generalização da chave de config por provedor
            self.app_state.config.set(provider, "model", selected)
            self.lbl_ai_status.SetLabel(f"📍 {selected}")

    def apply_theme(self):
        self.theme = ThemeManager()
        bg = self.theme.get_bg_color()
        fg = self.theme.get_fg_color()

        self.SetBackgroundColour(bg)

        # Botão de resumir mantém cor accent
        self.btn_summarize.SetBackgroundColour(self.theme.get_accent_color())
        self.btn_summarize.SetForegroundColour(wx.WHITE)

        # Botão export
        self.btn_export.SetBackgroundColour(self.theme.get_highlight_color())
        self.btn_export.SetForegroundColour(fg)

        # [6.2c] Botão refresh e cancel
        self.btn_refresh_models.SetBackgroundColour(self.theme.get_highlight_color())
        self.btn_refresh_models.SetForegroundColour(fg)
        self.btn_cancel.SetBackgroundColour(self.theme.get_highlight_color())
        self.btn_cancel.SetForegroundColour(wx.Colour(200, 50, 50))

        # [6.2c] Choice selectors
        self.choice_provider.SetBackgroundColour(self.theme.get_input_bg())
        self.choice_provider.SetForegroundColour(self.theme.get_input_fg())
        self.choice_model.SetBackgroundColour(self.theme.get_input_bg())
        self.choice_model.SetForegroundColour(self.theme.get_input_fg())

        # [6.2c] SearchCtrl
        self.search.SetBackgroundColour(self.theme.get_input_bg())
        self.search.SetForegroundColour(self.theme.get_input_fg())

        # [6.2c] StaticText BG + FG, StaticLine BG
        for child in self.GetChildren():
            if isinstance(child, wx.StaticText):
                child.SetBackgroundColour(bg)
                child.SetForegroundColour(fg)
            elif isinstance(child, wx.StaticLine):
                child.SetBackgroundColour(self.theme.get_border_color())

        self.Refresh()
