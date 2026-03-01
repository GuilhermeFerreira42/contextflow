# contextflow/ui/components/status_chip.py
import wx
from core.theme_manager import ThemeManager
from core.config_manager import ConfigManager
from core.pubsub import PubSub

class StatusChip(wx.Control):
    """
    Componente de Status Interativo (Phase 6.1.1).
    Exibe Provedor/Modelo ativo e permite troca rápida via Menu Popup Agrupado.
    Valida chaves de API em tempo real (✅/❌).
    """
    def __init__(self, parent):
        super().__init__(parent, style=wx.BORDER_NONE)
        self.config = ConfigManager()
        self.theme = ThemeManager()
        self.SetBackgroundColour(self.theme.COLOR_SECONDARY)
        self.SetCursor(wx.Cursor(wx.CURSOR_HAND))
        
        self._init_ui()
        self._bind_events()
        self.refresh()

    def _init_ui(self):
        self.sizer = wx.BoxSizer(wx.HORIZONTAL)
        self.lbl_text = wx.StaticText(self, label="[ AI STATUS ]")
        self.lbl_text.SetFont(wx.Font(8, wx.FONTFAMILY_DEFAULT, wx.FONTSTYLE_NORMAL, wx.FONTWEIGHT_BOLD))
        
        self.sizer.Add(self.lbl_text, 1, wx.CENTER | wx.ALL, 5)
        self.SetSizer(self.sizer)

    def _bind_events(self):
        self.Bind(wx.EVT_LEFT_DOWN, self.on_click)
        self.lbl_text.Bind(wx.EVT_LEFT_DOWN, self.on_click)
        PubSub.subscribe('CONFIG_CHANGED', self.on_config_changed)
        PubSub.subscribe('PROVIDER_CHANGED', self.on_config_changed)

    def on_config_changed(self, **kwargs):
        wx.CallAfter(self.refresh)

    def refresh(self):
        provider = self.config.get("orchestration", "active_provider", "openai").upper()
        
        # Mapeamento do modelo atual
        p_low = provider.lower()
        if p_low == "ollama":
            model = self.config.get("ollama", "model", "llama3")
        else:
            model = self.config.get("orchestration", f"{p_low}_model", "gpt-4o-mini")
        
        self.lbl_text.SetLabel(f" 🤖 {provider} | {model} ")
        self.lbl_text.SetForegroundColour(self.theme.COLOR_ACCENT)
        self.Layout()
        if self.GetParent(): self.GetParent().Layout()

    def on_click(self, event):
        menu = wx.Menu()
        
        # Grupos de Modelos (Conforme Specs 6.1.1)
        # Formato: Provider_Key, Label, Model_List
        groups = [
            ("openai", "OpenRouter / OpenAI", ["gpt-4o", "gpt-4o-mini", "o1-mini"]),
            ("anthropic", "Anthropic Claude", ["claude-3-5-sonnet-latest", "claude-3-opus-latest", "claude-3-haiku-latest"]),
            ("google", "Google Gemini", ["gemini-1.5-pro", "gemini-1.5-flash", "gemini-1.5-flash-8b"]),
            ("ollama", "Ollama (Local)", ["llama3", "mistral", "phi3"])
        ]
        
        active_provider = self.config.get("orchestration", "active_provider", "openai")
        
        for key, group_label, models in groups:
            # Handshake de Credenciais (RF-01)
            has_key = True
            if key != "ollama":
                # ConfigManager.get busca em user_settings, mas chaves ficam em credentials
                # No ContextFlow, chaves costumam estar sob prefixo do provedor
                api_key = self.config.get("api_keys", key, "")
                if not api_key: # Tenta credentials.json via fallback se o config_manager tiver essa lógica
                    # Assumindo que o ConfigManager já unifica ou tem método dedicado
                    # Para Fase 6.1.1, vamos usar a lógica de verificação direta
                    api_key = self.config.get("credentials", f"{key}_api_key", "")
                
                has_key = bool(api_key.strip())

            status_icon = "✅ " if has_key else "❌ "
            header_item = menu.Append(wx.ID_ANY, f"--- {status_icon}{group_label} ---")
            header_item.Enable(False) # Apenas label de grupo
            
            for m in models:
                item = menu.AppendRadioItem(wx.ID_ANY, m)
                
                # Check se é o modelo ativo
                p_match = (key == active_provider)
                current_model = ""
                if key == "ollama":
                    current_model = self.config.get("ollama", "model")
                else:
                    current_model = self.config.get("orchestration", f"{key}_model")
                
                if p_match and m == current_model:
                    item.Check(True)
                
                if not has_key:
                    # [FASE 6.1.1 FIX] Mantém habilitado mas redireciona para diálogo UX
                    self.Bind(wx.EVT_MENU, lambda e, k=key, gl=group_label: self._on_keyless_select(k, gl), item)
                else:
                    # Bind dinâmico normal
                    self.Bind(wx.EVT_MENU, lambda e, k=key, mod=m: self._set_model(k, mod), item)
            
            menu.AppendSeparator()
            
        self.PopupMenu(menu)
        menu.Destroy()

    def _on_keyless_select(self, provider_key, provider_label):
        """[FASE 6.1.1] Intervenção UX: Diálogo informativo com atalho para Configurações."""
        dlg = wx.MessageDialog(
            self.GetTopLevelParent(),
            f"O provedor {provider_label} não possui uma API Key configurada.\n\n"
            "Sem uma chave válida, não é possível utilizar este provedor.\n"
            "Deseja abrir as Configurações agora para inserir sua chave?",
            "Credencial Ausente",
            wx.YES_NO | wx.ICON_WARNING
        )
        if dlg.ShowModal() == wx.ID_YES:
            from ui.dialog_config import DialogConfig
            with DialogConfig(self.GetTopLevelParent()) as cfg:
                cfg.nb.SetSelection(1)  # Abre direto na aba "Conectividade IA"
                cfg.ShowModal()
        dlg.Destroy()
        self.refresh()

    def _set_model(self, provider, model):
        """Salva a nova seleção e notifica o sistema."""
        self.config.set("orchestration", "active_provider", provider)
        if provider == "ollama":
            self.config.set("ollama", "model", model)
        else:
            self.config.set("orchestration", f"{provider}_model", model)
            
        PubSub.publish('PROVIDER_CHANGED', provider=provider, model=model)
        PubSub.publish('CONFIG_CHANGED')
        self.refresh()
