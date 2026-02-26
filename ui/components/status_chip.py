# contextflow/ui/components/status_chip.py
import wx
from constants import COLOR_BG, COLOR_ACCENT, COLOR_FG
from core.config_manager import ConfigManager
from core.pubsub import PubSub

class StatusChip(wx.Control):
    """
    Componente de Status Interativo (Phase 6.1).
    Exibe Provedor/Modelo ativo e permite troca rápida via Menu Popup.
    """
    def __init__(self, parent):
        super().__init__(parent, style=wx.BORDER_NONE)
        self.config = ConfigManager()
        self.SetBackgroundColour(wx.Colour(245, 245, 245))
        self.SetCursor(wx.Cursor(wx.CURSOR_HAND))
        
        self._init_ui()
        self._bind_events()
        self.refresh()

    def _init_ui(self):
        self.sizer = wx.BoxSizer(wx.HORIZONTAL)
        self.lbl_text = wx.StaticText(self, label="[ AI STATUS ]")
        self.lbl_text.SetFont(wx.Font(8, wx.FONTFAMILY_DEFAULT, wx.FONTSTYLE_NORMAL, wx.FONTWEIGHT_BOLD))
        self.lbl_text.SetForegroundColour(wx.Colour(100, 100, 100))
        
        self.sizer.Add(self.lbl_text, 1, wx.CENTER | wx.ALL, 5)
        self.SetSizer(self.sizer)

    def _bind_events(self):
        self.Bind(wx.EVT_LEFT_DOWN, self.on_click)
        self.lbl_text.Bind(wx.EVT_LEFT_DOWN, self.on_click)
        PubSub.subscribe('CONFIG_CHANGED', self.on_config_changed)

    def on_config_changed(self):
        wx.CallAfter(self.refresh)

    def refresh(self):
        provider = self.config.get("orchestration", "active_provider", "openai").upper()
        
        model_key = f"{provider.lower()}_model"
        if provider.lower() == "ollama": model_key = "model"
        
        model = self.config.get("orchestration" if provider.lower() != "ollama" else "ollama", model_key, "default")
        
        self.lbl_text.SetLabel(f" 🤖 {provider} | {model} ")
        self.lbl_text.SetForegroundColour(COLOR_ACCENT)
        self.Layout()
        if self.GetParent(): self.GetParent().Layout()

    def on_click(self, event):
        menu = wx.Menu()
        
        providers = [
            ("openai", "OpenAI"),
            ("gemini", "Google Gemini"),
            ("anthropic", "Anthropic"),
            ("ollama", "Ollama (Local)")
        ]
        
        active_provider = self.config.get("orchestration", "active_provider", "openai")
        
        for key, label in providers:
            # Verifica se chave de API existe (exceto Ollama)
            has_key = True
            if key != "ollama":
                # Mapeia 'gemini' para a chave 'google' no credentials.json
                config_key = "google" if key == "gemini" else key
                api_key = self.config.get("api_keys", config_key, "")
                has_key = bool(api_key.strip())
            
            item = menu.AppendRadioItem(wx.ID_ANY, label)
            item.Check(key == active_provider)
            
            if not has_key:
                item.Enable(False)
                item.SetItemLabel(f"{label} (Sem Chave)")
            
            self.Bind(wx.EVT_MENU, lambda e, k=key: self._set_provider(k), item)
            
        self.PopupMenu(menu)
        menu.Destroy()

    def _set_provider(self, provider_key):
        self.config.set("orchestration", "active_provider", provider_key)
        # Notifica o sistema da mudança
        PubSub.publish('CONFIG_CHANGED')
        PubSub.publish('PROVIDER_CHANGED', provider=provider_key)
        self.refresh()
