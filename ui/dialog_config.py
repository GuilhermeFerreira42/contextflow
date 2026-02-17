# contextflow/ui/dialog_config.py
import wx
import logging
from core.config_manager import ConfigManager

logger = logging.getLogger("contextflow.ui.config")

class DialogConfig(wx.Dialog):
    """
    Console de Governança (Configurações)
    Centraliza a gestão de chaves de API, limites e orquestração.
    Padrão: HeidiSQL Options Dialóg.
    """
    def __init__(self, parent):
        super().__init__(parent, title="Governança & Configurações", size=(500, 550))
        self.config = ConfigManager()
        self._init_ui()

    def _init_ui(self):
        main_sizer = wx.BoxSizer(wx.VERTICAL)
        
        # Notebook para organizar por categorias
        nb = wx.Notebook(self)
        
        # --- ABA 1: API KEYS ---
        panel_api = wx.Panel(nb)
        api_sizer = wx.BoxSizer(wx.VERTICAL)
        
        api_sizer.Add(wx.StaticText(panel_api, label="Credenciais de IA (Cloud/Local)"), 0, wx.ALL, 10)
        
        self.ctrls = {}
        fields = [
            ("api_keys", "openai", "OpenAI API Key (sk-...)"),
            ("api_keys", "anthropic", "Anthropic API Key (sk-ant-...)"),
            ("api_keys", "google", "Google Gemini Key"),
            ("api_keys", "proxy_auth", "Proxy Auth (Optional)"),
        ]
        
        for section, key, label in fields:
            api_sizer.Add(wx.StaticText(panel_api, label=label), 0, wx.LEFT | wx.RIGHT, 10)
            txt = wx.TextCtrl(panel_api, style=wx.TE_PASSWORD if "key" in key else 0)
            txt.SetValue(str(self.config.get(section, key, "")))
            api_sizer.Add(txt, 0, wx.EXPAND | wx.ALL, 10)
            self.ctrls[f"{section}.{key}"] = txt
            
        panel_api.SetSizer(api_sizer)
        nb.AddPage(panel_api, "Chaves de API")
        
        # --- ABA 2: ORQUESTRAÇÃO ---
        panel_orch = wx.Panel(nb)
        orch_sizer = wx.BoxSizer(wx.VERTICAL)
        
        orch_sizer.Add(wx.StaticText(panel_orch, label="Limites e Performance"), 0, wx.ALL, 10)
        
        # Max Cloud Tasks
        orch_sizer.Add(wx.StaticText(panel_orch, label="Máximo de Tarefas Simultâneas (Cloud):"), 0, wx.LEFT | wx.RIGHT, 10)
        self.spin_cloud = wx.SpinCtrl(panel_orch, min=1, max=10)
        self.spin_cloud.SetValue(int(self.config.get("orchestration", "max_cloud_tasks", 2)))
        orch_sizer.Add(self.spin_cloud, 0, wx.EXPAND | wx.ALL, 10)
        
        # Auto-Export
        self.chk_auto = wx.CheckBox(panel_orch, label="Exportação Automática ao Concluir")
        self.chk_auto.SetValue(self.config.get("orchestration", "auto_export", False))
        orch_sizer.Add(self.chk_auto, 0, wx.ALL, 10)
        
        panel_orch.SetSizer(orch_sizer)
        nb.AddPage(panel_orch, "Orquestração")
        
        # --- ABA 3: EXTRAÇÃO & SEGURANÇA ---
        panel_sec = wx.Panel(nb)
        sec_sizer = wx.BoxSizer(wx.VERTICAL)
        
        sec_sizer.Add(wx.StaticText(panel_sec, label="Antifragilidade e Defesa"), 0, wx.ALL, 10)
        
        # Cooldown
        sec_sizer.Add(wx.StaticText(panel_sec, label="Tempo de Cooldown (minutos):"), 0, wx.LEFT | wx.RIGHT, 10)
        self.spin_cooldown = wx.SpinCtrl(panel_sec, min=1, max=60)
        self.spin_cooldown.SetValue(int(self.config.get("extraction_defense", "cooldown_mins", 10)))
        sec_sizer.Add(self.spin_cooldown, 0, wx.EXPAND | wx.ALL, 10)
        
        # Limit 429
        sec_sizer.Add(wx.StaticText(panel_sec, label="Limite de Erros 429 (Sistema de Pausa):"), 0, wx.LEFT | wx.RIGHT, 10)
        self.spin_429 = wx.SpinCtrl(panel_sec, min=1, max=10)
        self.spin_429.SetValue(int(self.config.get("extraction_defense", "errors_429_limit", 3)))
        sec_sizer.Add(self.spin_429, 0, wx.EXPAND | wx.ALL, 10)
        
        # Checkboxes Defesa
        self.chk_cookies = wx.CheckBox(panel_sec, label="Utilizar Cookies (Exportados do Navegador)")
        self.chk_cookies.SetValue(self.config.get("extraction_defense", "use_cookies", False))
        sec_sizer.Add(self.chk_cookies, 0, wx.ALL, 10)
        
        self.chk_proxies = wx.CheckBox(panel_sec, label="Habilitar Rotação de Proxies (Requer API Key Proxy)")
        self.chk_proxies.SetValue(self.config.get("extraction_defense", "use_proxies", False))
        sec_sizer.Add(self.chk_proxies, 0, wx.ALL, 10)
        
        # Subtitles
        sec_sizer.Add(wx.StaticText(panel_sec, label="Prioridade de Idiomas (Legenda):"), 0, wx.LEFT | wx.RIGHT | wx.TOP, 10)
        self.txt_subs = wx.TextCtrl(panel_sec)
        self.txt_subs.SetHint("Ex: pt,pt-BR,en")
        self.txt_subs.SetValue(str(self.config.get("subtitles", "language_order", "pt,pt-BR,en")))
        sec_sizer.Add(self.txt_subs, 0, wx.EXPAND | wx.ALL, 10)
        
        panel_sec.SetSizer(sec_sizer)
        nb.AddPage(panel_sec, "Extração")
        
        # --- ABA 4: INTERFACE ---
        panel_ui = wx.Panel(nb)
        ui_sizer = wx.BoxSizer(wx.VERTICAL)
        
        self.chk_tags = wx.CheckBox(panel_ui, label="Colorir Tags Automaticamente (Hash-Based)")
        self.chk_tags.SetValue(self.config.get("ui", "color_tags", True))
        ui_sizer.Add(self.chk_tags, 0, wx.ALL, 10)
        
        self.chk_dyn = wx.CheckBox(panel_ui, label="Habilitar Grade Dinâmica (Fast Rendering)")
        self.chk_dyn.SetValue(self.config.get("ui", "dynamic_tags", True))
        ui_sizer.Add(self.chk_dyn, 0, wx.ALL, 10)
        
        panel_ui.SetSizer(ui_sizer)
        nb.AddPage(panel_ui, "Interface")
        
        main_sizer.Add(nb, 1, wx.EXPAND | wx.ALL, 5)
        
        # Botões
        btn_sizer = wx.StdDialogButtonSizer()
        btn_ok = wx.Button(self, wx.ID_OK, label="SALVAR")
        btn_cancel = wx.Button(self, wx.ID_CANCEL, label="CANCELAR")
        btn_sizer.AddButton(btn_ok)
        btn_sizer.AddButton(btn_cancel)
        btn_sizer.Realize()
        
        main_sizer.Add(btn_sizer, 0, wx.ALIGN_RIGHT | wx.ALL, 10)
        self.SetSizer(main_sizer)
        
        btn_ok.Bind(wx.EVT_BUTTON, self.on_save)

    def on_save(self, event):
        # Salva API Keys
        for key_path, ctrl in self.ctrls.items():
            section, key = key_path.split(".")
            self.config.set(section, key, ctrl.GetValue())
            
        # Salva Orquestração
        self.config.set("orchestration", "max_cloud_tasks", self.spin_cloud.GetValue())
        self.config.set("orchestration", "auto_export", self.chk_auto.GetValue())
        
        # Salvas Extração & Defesa
        self.config.set("extraction_defense", "cooldown_mins", self.spin_cooldown.GetValue())
        self.config.set("extraction_defense", "errors_429_limit", self.spin_429.GetValue())
        self.config.set("extraction_defense", "use_cookies", self.chk_cookies.GetValue())
        self.config.set("extraction_defense", "use_proxies", self.chk_proxies.GetValue())
        self.config.set("subtitles", "language_order", self.txt_subs.GetValue())
        
        # Salva UI
        self.config.set("ui", "color_tags", self.chk_tags.GetValue())
        self.config.set("ui", "dynamic_tags", self.chk_dyn.GetValue())
        
        self.config.save()
        logger.info("Configurações salvas via Console de Governança.")
        self.EndModal(wx.ID_OK)
