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
        
        # --- ABA 3: UI/UX ---
        panel_ui = wx.Panel(nb)
        ui_sizer = wx.BoxSizer(wx.VERTICAL)
        
        self.chk_undo = wx.CheckBox(panel_ui, label="Habilitar Modo Undo (Snackbar 5s)")
        self.chk_undo.SetValue(self.config.get("ui", "undo_enabled", True))
        ui_sizer.Add(self.chk_undo, 0, wx.ALL, 10)
        
        self.chk_tags = wx.CheckBox(panel_ui, label="Colorir Tags Automaticamente")
        self.chk_tags.SetValue(self.config.get("ui", "color_tags", True))
        ui_sizer.Add(self.chk_tags, 0, wx.ALL, 10)
        
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
        
        # Salva UI
        self.config.set("ui", "undo_enabled", self.chk_undo.GetValue())
        self.config.set("ui", "color_tags", self.chk_tags.GetValue())
        
        self.config.save()
        logger.info("Configurações salvas via Console de Governança.")
        self.EndModal(wx.ID_OK)
