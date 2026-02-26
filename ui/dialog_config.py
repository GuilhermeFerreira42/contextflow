# contextflow/ui/dialog_config.py
import wx
import os
import logging
import time
from core.config_manager import ConfigManager
from core.pubsub import PubSub
from core.cooldown_manager import CooldownManager

logger = logging.getLogger("contextflow.ui.config")

class DialogConfig(wx.Dialog):
    """
    OPERATIONAL CONTROL PANEL v5.12 - DEEP SANEAMENTO
    Fidelidade total ao Mockup e Structural Standards.
    3 Abas: Extração, Conectividade IA, Orquestração.
    """
    def __init__(self, parent):
        super().__init__(parent, title="Painel de Controle Operacional — ContextFlow", size=(800, 600), 
                         style=wx.DEFAULT_DIALOG_STYLE | wx.RESIZE_BORDER)
        self.config = ConfigManager()
        self.cooldown_mgr = CooldownManager()
        self.SetBackgroundColour(wx.WHITE)
        
        self.timer = wx.Timer(self)
        self.Bind(wx.EVT_TIMER, self.on_update_status, self.timer)
        
        self._init_ui()
        self.timer.Start(1000) # Update status footer every second

    def _init_ui(self):
        main_sizer = wx.BoxSizer(wx.VERTICAL)

        # Header Estilizado
        header_panel = wx.Panel(self)
        header_panel.SetBackgroundColour(wx.WHITE)
        header_sizer = wx.BoxSizer(wx.VERTICAL)
        
        lbl_title = wx.StaticText(header_panel, label="Console de Governança & Parâmetros de Core")
        lbl_title.SetFont(wx.Font(12, wx.FONTFAMILY_DEFAULT, wx.FONTSTYLE_NORMAL, wx.FONTWEIGHT_BOLD))
        lbl_title.SetForegroundColour(wx.Colour(15, 23, 42)) 
        
        lbl_subtitle = wx.StaticText(header_panel, label="Monitoramento soberano e configuração de resiliência.")
        lbl_subtitle.SetFont(wx.Font(9, wx.FONTFAMILY_DEFAULT, wx.FONTSTYLE_NORMAL, wx.FONTWEIGHT_NORMAL))
        lbl_subtitle.SetForegroundColour(wx.Colour(100, 116, 139)) 
        
        header_sizer.Add(lbl_title, 0, wx.TOP | wx.LEFT | wx.RIGHT, 15)
        header_sizer.Add(lbl_subtitle, 0, wx.BOTTOM | wx.LEFT | wx.RIGHT, 15)
        header_panel.SetSizer(header_sizer)
        main_sizer.Add(header_panel, 0, wx.EXPAND)

        # Notebook (Abas)
        self.nb = wx.Notebook(self)
        
        # ABA 1: EXTRAÇÃO & SEGURANÇA
        self.tab_extraction = self._create_tab_extraction()
        self.nb.AddPage(self.tab_extraction, "1. Extração & Segurança")
        
        # ABA 2: CONECTIVIDADE IA
        self.tab_ai = self._create_tab_ai()
        self.nb.AddPage(self.tab_ai, "2. Conectividade IA")
        
        # ABA 3: ORQUESTRAÇÃO & PERFORMANCE
        self.tab_orch = self._create_tab_orchestration()
        self.nb.AddPage(self.tab_orch, "3. Orquestração & Performance")

        main_sizer.Add(self.nb, 1, wx.EXPAND | wx.ALL, 10)

        # Rodapé de Observabilidade (Status em Tempo Real)
        self.status_bar = wx.Panel(self)
        self.status_bar.SetBackgroundColour(wx.Colour(241, 245, 249)) # Slate 100
        status_sizer = wx.BoxSizer(wx.HORIZONTAL)
        
        self.lbl_status_shield = wx.StaticText(self.status_bar, label="Escudo: Inativo")
        self.lbl_status_shield.SetFont(wx.Font(8, wx.FONTFAMILY_DEFAULT, wx.FONTSTYLE_NORMAL, wx.FONTWEIGHT_BOLD))
        
        self.lbl_status_proxies = wx.StaticText(self.status_bar, label="Proxies: 0 Ativos")
        self.lbl_status_proxies.SetFont(wx.Font(8, wx.FONTFAMILY_DEFAULT, wx.FONTSTYLE_NORMAL, wx.FONTWEIGHT_NORMAL))
        
        self.lbl_status_cookies = wx.StaticText(self.status_bar, label="Cookies: Ausentes")
        self.lbl_status_cookies.SetFont(wx.Font(8, wx.FONTFAMILY_DEFAULT, wx.FONTSTYLE_NORMAL, wx.FONTWEIGHT_NORMAL))
        
        status_sizer.Add(self.lbl_status_shield, 0, wx.ALL | wx.ALIGN_CENTER_VERTICAL, 10)
        status_sizer.AddStretchSpacer()
        status_sizer.Add(self.lbl_status_proxies, 0, wx.ALL | wx.ALIGN_CENTER_VERTICAL, 10)
        status_sizer.Add(self.lbl_status_cookies, 0, wx.ALL | wx.ALIGN_CENTER_VERTICAL, 10)
        
        self.status_bar.SetSizer(status_sizer)
        main_sizer.Add(self.status_bar, 0, wx.EXPAND)

        # Rodapé de Ações
        action_panel = wx.Panel(self)
        action_panel.SetBackgroundColour(wx.WHITE)
        action_sizer = wx.BoxSizer(wx.HORIZONTAL)
        
        btn_cancel = wx.Button(action_panel, wx.ID_CANCEL, label="Cancelar", size=(100, 35))
        btn_save = wx.Button(action_panel, wx.ID_OK, label="Sincronizar & Salvar", size=(160, 35))
        btn_save.SetBackgroundColour(wx.Colour(37, 99, 235)) 
        btn_save.SetForegroundColour(wx.WHITE)
        btn_save.SetFont(wx.Font(9, wx.FONTFAMILY_DEFAULT, wx.FONTSTYLE_NORMAL, wx.FONTWEIGHT_BOLD))
        
        action_sizer.Add(btn_cancel, 0, wx.RIGHT, 10)
        action_sizer.Add(btn_save, 0)
        action_panel.SetSizer(action_sizer)
        main_sizer.Add(action_panel, 0, wx.ALIGN_RIGHT | wx.ALL, 15)

        self.SetSizer(main_sizer)
        btn_save.Bind(wx.EVT_BUTTON, self.on_save)
        self.on_update_status(None) # Initial update

    def _create_tab_extraction(self):
        panel = wx.ScrolledWindow(self.nb)
        panel.SetScrollRate(0, 20)
        panel.SetBackgroundColour(wx.Colour(248, 250, 252))
        sizer = wx.BoxSizer(wx.VERTICAL)

        # BLOCO A: Controle de Limites e Proteção
        self._block_a_limits(panel, sizer)
        
        # Grid para BLOCO B e C
        mid_grid = wx.BoxSizer(wx.HORIZONTAL)
        self._block_b_cookies(panel, mid_grid)
        mid_grid.AddSpacer(15)
        self._block_c_proxies(panel, mid_grid)
        sizer.Add(mid_grid, 0, wx.EXPAND | wx.LEFT | wx.RIGHT | wx.BOTTOM, 15)
        
        # BLOCO D: Prioridade de Idiomas
        self._block_d_languages(panel, sizer)

        # [PHASE_5_12] Botão de Cancelamento Operacional (Abortar Tudo)
        btn_abort = wx.Button(panel, label="🛑 Cancelar Todos os Processamentos Ativos", size=(-1, 40))
        btn_abort.SetBackgroundColour(wx.Colour(239, 68, 68)) # Red 500
        btn_abort.SetForegroundColour(wx.WHITE)
        btn_abort.SetFont(wx.Font(9, wx.FONTFAMILY_DEFAULT, wx.FONTSTYLE_NORMAL, wx.FONTWEIGHT_BOLD))
        btn_abort.Bind(wx.EVT_BUTTON, self.on_abort_all)
        sizer.Add(btn_abort, 0, wx.EXPAND | wx.ALL, 15)

        panel.SetSizer(sizer)
        return panel

    def _create_tab_ai(self):
        panel = wx.ScrolledWindow(self.nb)
        panel.SetScrollRate(0, 20)
        panel.SetBackgroundColour(wx.Colour(248, 250, 252))
        sizer = wx.BoxSizer(wx.VERTICAL)

        # BLOCO: Credenciais de API (Saneamento de Persistência)
        sec_api = wx.StaticBox(panel, label="Credenciais de Provedores Cloud")
        sec_api.SetFont(wx.Font(9, wx.FONTFAMILY_DEFAULT, wx.FONTSTYLE_NORMAL, wx.FONTWEIGHT_BOLD))
        api_sizer = wx.StaticBoxSizer(sec_api, wx.VERTICAL)
        
        grid = wx.FlexGridSizer(rows=0, cols=2, vgap=10, hgap=10)
        grid.AddGrowableCol(1)
        
        providers = [
            ("OpenAI API Key:", "openai"),
            ("Anthropic API:", "anthropic"),
            ("Google / Gemini:", "google"),
            ("Grok (xAI):", "grok"),
            ("GROQ API:", "groq"),
            ("Azure OpenAI:", "azure"),
            ("OpenRouter:", "openrouter")
        ]
        
        self.ai_inputs = {}
        for label, key in providers:
            grid.Add(wx.StaticText(panel, label=label), 0, wx.ALIGN_CENTER_VERTICAL)
            
            row_api = wx.BoxSizer(wx.HORIZONTAL)
            txt = wx.TextCtrl(panel, style=wx.TE_PASSWORD)
            txt.SetValue(self.config.get("api_keys", key, ""))
            row_api.Add(txt, 1, wx.EXPAND)
            
            # Botão de Olho (Toggle Visibilidade)
            btn_eye = wx.Button(panel, label="👁", size=(30, 24))
            btn_eye.SetToolTip(f"Mostrar/Ocultar {label}")
            row_api.Add(btn_eye, 0, wx.LEFT, 5)
            
            def on_toggle_visibility(event, b=btn_eye, k=key, sz=row_api):
                panel.Freeze()
                try:
                    current_t = self.ai_inputs[k]
                    val = current_t.GetValue()
                    is_pw = bool(current_t.GetWindowStyleFlag() & wx.TE_PASSWORD)
                    new_style = wx.TE_LEFT if is_pw else wx.TE_PASSWORD
                    new_t = wx.TextCtrl(panel, style=new_style)
                    new_t.SetValue(val)
                    sz.Replace(current_t, new_t)
                    current_t.Destroy()
                    self.ai_inputs[k] = new_t
                    b.SetLabel("👁" if not is_pw else "👓")
                    panel.Layout()
                    new_t.SetFocus()
                    new_t.SetInsertionPointEnd()
                finally:
                    panel.Thaw()
                
            btn_eye.Bind(wx.EVT_BUTTON, on_toggle_visibility)
            grid.Add(row_api, 1, wx.EXPAND)
            self.ai_inputs[key] = txt
            
        api_sizer.Add(grid, 1, wx.EXPAND | wx.ALL, 10)
        
        # Legenda de Segurança
        lbl_sec = wx.StaticText(panel, label="* As chaves são armazenadas localmente em config/credentials.json.")
        lbl_sec.SetFont(wx.Font(8, wx.FONTFAMILY_DEFAULT, wx.FONTSTYLE_ITALIC, wx.FONTWEIGHT_NORMAL))
        lbl_sec.SetForegroundColour(wx.Colour(100, 116, 139))
        api_sizer.Add(lbl_sec, 0, wx.LEFT | wx.RIGHT | wx.BOTTOM, 10)

        sizer.Add(api_sizer, 0, wx.EXPAND | wx.ALL, 15)

        # BLOCO: Ollama (Conectividade Local)
        sec_local = wx.StaticBox(panel, label="Ollama (Conectividade Local)")
        sec_local.SetFont(wx.Font(9, wx.FONTFAMILY_DEFAULT, wx.FONTSTYLE_NORMAL, wx.FONTWEIGHT_BOLD))
        local_sizer = wx.StaticBoxSizer(sec_local, wx.VERTICAL)
        
        l_grid = wx.FlexGridSizer(rows=2, cols=2, vgap=10, hgap=10)
        l_grid.AddGrowableCol(1)
        
        l_grid.Add(wx.StaticText(panel, label="Endpoint URL:"), 0, wx.ALIGN_CENTER_VERTICAL)
        self.txt_ollama_url = wx.TextCtrl(panel)
        self.txt_ollama_url.SetValue(self.config.get("ollama", "endpoint", "http://localhost:11434"))
        l_grid.Add(self.txt_ollama_url, 1, wx.EXPAND)
        
        l_grid.Add(wx.StaticText(panel, label="Model Name:"), 0, wx.ALIGN_CENTER_VERTICAL)
        row_model = wx.BoxSizer(wx.HORIZONTAL)
        self.choice_ollama_model = wx.ComboBox(panel, style=wx.CB_DROPDOWN)
        self.choice_ollama_model.SetValue(self.config.get("ollama", "model", "llama3"))
        row_model.Add(self.choice_ollama_model, 1, wx.EXPAND)
        
        btn_discover = wx.Button(panel, label="🔍 Buscar", size=(70, 24))
        btn_discover.SetToolTip("Descobrir modelos instalados no Ollama")
        row_model.Add(btn_discover, 0, wx.LEFT, 5)
        l_grid.Add(row_model, 1, wx.EXPAND)
        
        def on_discover_ollama(event):
            from core.adapters.ollama_adapter import OllamaAdapter
            adapter = OllamaAdapter()
            url = self.txt_ollama_url.GetValue()
            models = adapter.get_available_models({"base_url": url})
            if models:
                current = self.choice_ollama_model.GetValue()
                self.choice_ollama_model.SetItems(models)
                if current in models: self.choice_ollama_model.SetValue(current)
                elif models: self.choice_ollama_model.SetSelection(0)
                wx.MessageBox(f"Encontrados {len(models)} modelos no Ollama.", "Descoberta OK", wx.OK | wx.ICON_INFORMATION)
            else:
                wx.MessageBox("Não foi possível conectar ao Ollama ou nenhum modelo encontrado.", "Falha de Descoberta", wx.OK | wx.ICON_ERROR)
        
        btn_discover.Bind(wx.EVT_BUTTON, on_discover_ollama)
        local_sizer.Add(l_grid, 1, wx.EXPAND | wx.ALL, 10)
        sizer.Add(local_sizer, 0, wx.EXPAND | wx.LEFT | wx.RIGHT | wx.BOTTOM, 15)

        # BLOCO: Seletor de Provedor Ativo
        sec_sel = wx.StaticBox(panel, label="Seletor de Inteligência Ativa")
        sec_sel.SetFont(wx.Font(9, wx.FONTFAMILY_DEFAULT, wx.FONTSTYLE_NORMAL, wx.FONTWEIGHT_BOLD))
        sel_sizer = wx.StaticBoxSizer(sec_sel, wx.VERTICAL)
        
        row = wx.BoxSizer(wx.HORIZONTAL)
        row.Add(wx.StaticText(panel, label="Provedor Padrão:"), 0, wx.ALIGN_CENTER_VERTICAL)
        self.choice_provider = wx.Choice(panel, choices=["openai", "google", "anthropic", "grok", "groq", "azure", "openrouter", "ollama"])
        current_provider = self.config.get("orchestration", "active_provider", "openai")
        idx = self.choice_provider.FindString(current_provider)
        if idx != wx.NOT_FOUND: self.choice_provider.SetSelection(idx)
        else: self.choice_provider.SetSelection(0)
        row.Add(self.choice_provider, 1, wx.LEFT | wx.EXPAND, 10)
        
        sel_sizer.Add(row, 0, wx.EXPAND | wx.ALL, 10)
        sizer.Add(sel_sizer, 0, wx.EXPAND | wx.LEFT | wx.RIGHT | wx.BOTTOM, 15)

        panel.SetSizer(sizer)
        return panel

    def _create_tab_orchestration(self):
        panel = wx.ScrolledWindow(self.nb)
        panel.SetScrollRate(0, 20)
        panel.SetBackgroundColour(wx.Colour(248, 250, 252))
        sizer = wx.BoxSizer(wx.VERTICAL)

        # BLOCO: Concurrency Pool
        sec_pool = wx.StaticBox(panel, label="Concurrency Pool (Hardware Effort)")
        sec_pool.SetFont(wx.Font(9, wx.FONTFAMILY_DEFAULT, wx.FONTSTYLE_NORMAL, wx.FONTWEIGHT_BOLD))
        pool_sizer = wx.StaticBoxSizer(sec_pool, wx.VERTICAL)
        
        p_grid = wx.FlexGridSizer(rows=2, cols=3, vgap=15, hgap=10)
        
        p_grid.Add(wx.StaticText(panel, label="Limite Nuvem (API):"), 0, wx.ALIGN_CENTER_VERTICAL)
        self.spin_cloud = wx.SpinCtrl(panel, value="2", min=1, max=4)
        self.spin_cloud.SetValue(self.config.get("orchestration", "max_cloud_tasks", 2))
        p_grid.Add(self.spin_cloud, 0, wx.ALIGN_CENTER_VERTICAL)
        p_grid.Add(wx.StaticText(panel, label="tarefas simultâneas"), 0, wx.ALIGN_CENTER_VERTICAL)
        
        p_grid.Add(wx.StaticText(panel, label="Limite Local (Ollama):"), 0, wx.ALIGN_CENTER_VERTICAL)
        self.spin_local = wx.SpinCtrl(panel, value="1", min=1, max=2)
        self.spin_local.SetValue(self.config.get("orchestration", "max_local_tasks", 1))
        p_grid.Add(self.spin_local, 0, wx.ALIGN_CENTER_VERTICAL)
        p_grid.Add(wx.StaticText(panel, label="tarefas simultâneas (recomendado: 1)"), 0, wx.ALIGN_CENTER_VERTICAL)
        
        pool_sizer.Add(p_grid, 1, wx.EXPAND | wx.ALL, 10)
        sizer.Add(pool_sizer, 0, wx.EXPAND | wx.ALL, 15)

        # BLOCO: Interface e Visual
        sec_ui = wx.StaticBox(panel, label="Interface & Estética")
        sec_ui.SetFont(wx.Font(9, wx.FONTFAMILY_DEFAULT, wx.FONTSTYLE_NORMAL, wx.FONTWEIGHT_BOLD))
        ui_sizer = wx.StaticBoxSizer(sec_ui, wx.VERTICAL)
        
        self.chk_dynamic_grid = wx.CheckBox(panel, label="Habilitar Grade Dinâmica (Miniaturas e Tags Coloridas)")
        self.chk_dynamic_grid.SetValue(self.config.get("ui", "dynamic_grid", True))
        ui_sizer.Add(self.chk_dynamic_grid, 0, wx.ALL, 10)
        
        sizer.Add(ui_sizer, 0, wx.EXPAND | wx.LEFT | wx.RIGHT | wx.BOTTOM, 15)

        # BLOCO: Persistência
        sec_per = wx.StaticBox(panel, label="Regras de Persistência")
        sec_per.SetFont(wx.Font(9, wx.FONTFAMILY_DEFAULT, wx.FONTSTYLE_NORMAL, wx.FONTWEIGHT_BOLD))
        per_sizer = wx.StaticBoxSizer(sec_per, wx.VERTICAL)
        
        self.chk_resume = wx.CheckBox(panel, label="Retomar tarefas pendentes ao reiniciar aplicação")
        self.chk_resume.SetValue(self.config.get("orchestration", "resume_tasks", True))
        per_sizer.Add(self.chk_resume, 0, wx.ALL, 10)
        
        sizer.Add(per_sizer, 0, wx.EXPAND | wx.LEFT | wx.RIGHT | wx.BOTTOM, 15)

        panel.SetSizer(sizer)
        return panel

    # --- Blocos Cirúrgicos (Saneamento 5.12) ---
    def _block_a_limits(self, parent, sizer):
        box = wx.StaticBox(parent, label="Controle de Limites e Proteção Automática (Escudo)")
        box.SetFont(wx.Font(9, wx.FONTFAMILY_DEFAULT, wx.FONTSTYLE_NORMAL, wx.FONTWEIGHT_BOLD))
        b_sizer = wx.StaticBoxSizer(box, wx.VERTICAL)
        
        grid = wx.FlexGridSizer(rows=3, cols=4, vgap=10, hgap=10)
        
        # 1. Limite de Itens
        grid.Add(wx.StaticText(parent, label="Aviso de Segurança (Fila):"), 0, wx.ALIGN_CENTER_VERTICAL)
        self.spin_q_limit = wx.SpinCtrl(parent, value="20", min=1, max=1000)
        self.spin_q_limit.SetValue(self.config.get("orchestration", "max_queue_warning", 20))
        grid.Add(self.spin_q_limit, 0, wx.ALIGN_CENTER_VERTICAL)
        
        # 3. Tempo de Espera (PRECISÃO SEGUNDOS)
        grid.Add(wx.StaticText(parent, label="Intervalo de Espera (seg):"), 0, wx.ALIGN_CENTER_VERTICAL)
        self.spin_cooldown = wx.SpinCtrl(parent, value="3600", min=60, max=86400)
        self.spin_cooldown.SetValue(self.config.get("extraction_defense", "cooldown_secs", 3600))
        grid.Add(self.spin_cooldown, 0, wx.ALIGN_CENTER_VERTICAL)
        
        # 4. Modo de Rotação (ADICIONADO)
        grid.Add(wx.StaticText(parent, label="Rotação de Proxy:"), 0, wx.ALIGN_CENTER_VERTICAL | wx.LEFT, 15)
        self.choice_rotation = wx.Choice(parent, choices=["Aleatório", "Round-Robin"])
        current_mode = self.config.get("orchestration", "proxy_rotation_mode", "Aleatório")
        idx = self.choice_rotation.FindString(current_mode)
        if idx != wx.NOT_FOUND: self.choice_rotation.SetSelection(idx)
        else: self.choice_rotation.SetSelection(0)
        grid.Add(self.choice_rotation, 0, wx.ALIGN_CENTER_VERTICAL)
        
        # 2. Limite de Erros (RESTAURADO)
        grid.Add(wx.StaticText(parent, label="Limite de Tentativas Falhas:"), 0, wx.ALIGN_CENTER_VERTICAL)
        self.spin_fail_limit = wx.SpinCtrl(parent, value="5", min=1, max=20)
        self.spin_fail_limit.SetValue(self.config.get("extraction_defense", "errors_429_limit", 5))
        grid.Add(self.spin_fail_limit, 0, wx.ALIGN_CENTER_VERTICAL)
        
        grid.AddSpacer(15)
        grid.AddSpacer(15)

        b_sizer.Add(grid, 0, wx.EXPAND | wx.ALL, 10)

        # Legendas Explicativas (Mandato 5.12)
        legend_font = wx.Font(8, wx.FONTFAMILY_DEFAULT, wx.FONTSTYLE_ITALIC, wx.FONTWEIGHT_NORMAL)
        
        lbl_cool_desc = wx.StaticText(parent, label="* Intervalo de Espera: Tempo que o IP fica em 'molho' após exceder falhas.")
        lbl_cool_desc.SetFont(legend_font)
        lbl_cool_desc.SetForegroundColour(wx.Colour(100, 116, 139))
        b_sizer.Add(lbl_cool_desc, 0, wx.LEFT | wx.RIGHT | wx.BOTTOM, 10)

        lbl_fail_desc = wx.StaticText(parent, label="* Limite de Tentativas Falhas: Quantidade de erros 429 permitidos antes do bloqueio.")
        lbl_fail_desc.SetFont(legend_font)
        lbl_fail_desc.SetForegroundColour(wx.Colour(100, 116, 139))
        b_sizer.Add(lbl_fail_desc, 0, wx.LEFT | wx.RIGHT | wx.BOTTOM, 10)

        lbl_queue_desc = wx.StaticText(parent, label="* Aviso de Segurança (Fila): O sistema solicitará confirmação manual ao exceder este limite.")
        lbl_queue_desc.SetFont(legend_font)
        lbl_queue_desc.SetForegroundColour(wx.Colour(100, 116, 139))
        b_sizer.Add(lbl_queue_desc, 0, wx.LEFT | wx.RIGHT | wx.BOTTOM, 10)
        
        # 5. Shield Toggle
        self.chk_protection = wx.CheckBox(parent, label="Habilitar Proteção Automática (Regra Alpha)")
        self.chk_protection.SetValue(self.config.get("orchestration", "auto_defense_enabled", True))
        self.chk_protection.SetFont(wx.Font(8, wx.FONTFAMILY_DEFAULT, wx.FONTSTYLE_NORMAL, wx.FONTWEIGHT_BOLD))
        b_sizer.Add(self.chk_protection, 0, wx.ALL, 10)
        
        sizer.Add(b_sizer, 0, wx.EXPAND | wx.ALL, 15)

    def _block_b_cookies(self, parent, sizer):
        box = wx.StaticBox(parent, label="Autenticação (Cookies Netscape)")
        box.SetFont(wx.Font(9, wx.FONTFAMILY_DEFAULT, wx.FONTSTYLE_NORMAL, wx.FONTWEIGHT_BOLD))
        b_sizer = wx.StaticBoxSizer(box, wx.VERTICAL)
        
        btn_import = wx.Button(parent, label="↑ Importar cookies.txt", size=(-1, 30))
        b_sizer.Add(btn_import, 0, wx.EXPAND | wx.ALL, 5)
        btn_import.Bind(wx.EVT_BUTTON, self.on_import_cookies)
        
        self.txt_cookies = wx.TextCtrl(parent, style=wx.TE_MULTILINE, size=(-1, 120))
        self.txt_cookies.SetFont(wx.Font(8, wx.FONTFAMILY_TELETYPE, wx.FONTSTYLE_NORMAL, wx.FONTWEIGHT_NORMAL))
        self.txt_cookies.SetValue(self.config.get("inputs", "cookie_text", ""))
        b_sizer.Add(self.txt_cookies, 1, wx.EXPAND | wx.ALL, 5)
        
        sizer.Add(b_sizer, 1, wx.EXPAND)

    def _block_c_proxies(self, parent, sizer):
        box = wx.StaticBox(parent, label="Rede e Proxies (Hot-Reload)")
        box.SetFont(wx.Font(9, wx.FONTFAMILY_DEFAULT, wx.FONTSTYLE_NORMAL, wx.FONTWEIGHT_BOLD))
        b_sizer = wx.StaticBoxSizer(box, wx.VERTICAL)
        
        self.chk_proxies = wx.CheckBox(parent, label="Ativar Rotação de Proxies")
        self.chk_proxies.SetValue(self.config.get("extraction_defense", "use_proxies", False))
        b_sizer.Add(self.chk_proxies, 0, wx.ALL, 5)
        
        self.txt_proxies = wx.TextCtrl(parent, style=wx.TE_MULTILINE, size=(-1, 120))
        self.txt_proxies.SetFont(wx.Font(8, wx.FONTFAMILY_TELETYPE, wx.FONTSTYLE_NORMAL, wx.FONTWEIGHT_NORMAL))
        self.txt_proxies.SetValue(self.config.get("inputs", "proxy_text", ""))
        b_sizer.Add(self.txt_proxies, 1, wx.EXPAND | wx.ALL, 5)
        
        sizer.Add(b_sizer, 1, wx.EXPAND)

    def _block_d_languages(self, parent, sizer):
        box = wx.StaticBox(parent, label="Prioridade Visual de Idiomas")
        box.SetFont(wx.Font(9, wx.FONTFAMILY_DEFAULT, wx.FONTSTYLE_NORMAL, wx.FONTWEIGHT_BOLD))
        b_sizer = wx.StaticBoxSizer(box, wx.VERTICAL)
        
        ctrl_sizer = wx.BoxSizer(wx.HORIZONTAL)
        
        self.list_langs = wx.ListBox(parent, style=wx.LB_SINGLE, size=(-1, 80))
        langs = self.config.get("subtitles", "language_order", "pt-BR,pt,en").split(",")
        self.list_langs.SetItems(langs)
        ctrl_sizer.Add(self.list_langs, 1, wx.EXPAND | wx.ALL, 5)
        
        btn_box = wx.BoxSizer(wx.VERTICAL)
        btn_up = wx.Button(parent, label="↑", size=(30, 30))
        btn_down = wx.Button(parent, label="↓", size=(30, 30))
        btn_box.Add(btn_up, 0, wx.BOTTOM, 5)
        btn_box.Add(btn_down, 0)
        ctrl_sizer.Add(btn_box, 0, wx.ALIGN_CENTER_VERTICAL | wx.ALL, 5)
        
        b_sizer.Add(ctrl_sizer, 0, wx.EXPAND)
        
        btn_restore = wx.Button(parent, label="Restaurar Padrão (pt-BR, pt, en)")
        btn_restore.Bind(wx.EVT_BUTTON, self.on_restore_languages)
        b_sizer.Add(btn_restore, 0, wx.ALIGN_CENTER | wx.TOP | wx.BOTTOM, 5)
        
        sizer.Add(b_sizer, 0, wx.EXPAND | wx.LEFT | wx.RIGHT | wx.BOTTOM, 15)
        
        btn_up.Bind(wx.EVT_BUTTON, self.on_move_up)
        btn_down.Bind(wx.EVT_BUTTON, self.on_move_down)

    # --- Handlers ---
    def on_restore_languages(self, event):
        self.list_langs.SetItems(["pt-BR", "pt", "en"])

    def on_update_status(self, event):
        # Escudo
        if self.cooldown_mgr.is_cooling_down():
            rem = self.cooldown_mgr.get_remaining_cooldown()
            self.lbl_status_shield.SetLabel(f"🛡️ Escudo: ATIVO ({rem}s)")
            self.lbl_status_shield.SetForegroundColour(wx.Colour(220, 38, 38)) # Red 600
        else:
            self.lbl_status_shield.SetLabel("🛡️ Escudo: Inativo")
            self.lbl_status_shield.SetForegroundColour(wx.Colour(22, 163, 74)) # Green 600
            
        # Proxies
        from core.proxy_manager import ProxyManager
        pm = ProxyManager()
        active = len(pm.proxies) - len(pm.banned_proxies)
        self.lbl_status_proxies.SetLabel(f"🌐 Proxies: {active}/{len(pm.proxies)} Válidos")
        
        # Cookies
        from constants import COOKIES_PATH
        has_cookies = os.path.exists(COOKIES_PATH)
        self.lbl_status_cookies.SetLabel(f"🍪 Cookies: {'OK' if has_cookies else 'Vazio'}")
        self.lbl_status_cookies.SetForegroundColour(wx.Colour(37, 99, 235) if has_cookies else wx.Colour(100, 116, 139))

    def on_move_up(self, event):
        idx = self.list_langs.GetSelection()
        if idx > 0:
            item = self.list_langs.GetString(idx)
            self.list_langs.Delete(idx)
            self.list_langs.Insert(item, idx - 1)
            self.list_langs.SetSelection(idx - 1)

    def on_move_down(self, event):
        idx = self.list_langs.GetSelection()
        if idx != wx.NOT_FOUND and idx < self.list_langs.GetCount() - 1:
            item = self.list_langs.GetString(idx)
            self.list_langs.Delete(idx)
            self.list_langs.Insert(item, idx + 1)
            self.list_langs.SetSelection(idx + 1)

    def on_import_cookies(self, event):
        with wx.FileDialog(self, "Selecionar cookies.txt", wildcard="TXT files (*.txt)|*.txt",
                           style=wx.FD_OPEN | wx.FD_FILE_MUST_EXIST) as fd:
            if fd.ShowModal() == wx.ID_OK:
                try:
                    with open(fd.GetPath(), 'r', encoding='utf-8') as f:
                        self.txt_cookies.SetValue(f.read())
                except Exception as e:
                    wx.MessageBox(f"Falha ao ler arquivo: {e}", "Erro", wx.OK | wx.ICON_ERROR)

    def on_save(self, event):
        # SALVAMENTO SANEADO - Fiel ao ConfigManager
        
        # ABA 1: EXTRAÇÃO
        self.config.set("orchestration", "max_queue_warning", self.spin_q_limit.GetValue())
        self.config.set("orchestration", "auto_defense_enabled", self.chk_protection.GetValue())
        self.config.set("orchestration", "proxy_rotation_mode", self.choice_rotation.GetStringSelection())
        
        self.config.set("extraction_defense", "errors_429_limit", self.spin_fail_limit.GetValue())
        self.config.set("extraction_defense", "cooldown_secs", self.spin_cooldown.GetValue())
        self.config.set("extraction_defense", "use_proxies", self.chk_proxies.GetValue())
        
        self.config.set("inputs", "cookie_text", self.txt_cookies.GetValue())
        self.config.set("inputs", "proxy_text", self.txt_proxies.GetValue())
        
        self.config.set("subtitles", "language_order", ",".join(self.list_langs.GetStrings()))
        
        # ABA 2: IA (RESTAURAÇÃO COMPLETA DO SALVAMENTO)
        for key, ctrl in self.ai_inputs.items():
            self.config.set("api_keys", key, ctrl.GetValue()) # PERSISTÊNCIA DAS CHAVES
            
        self.config.set("ollama", "endpoint", self.txt_ollama_url.GetValue())
        self.config.set("ollama", "model", self.choice_ollama_model.GetValue())
        self.config.set("orchestration", "active_provider", self.choice_provider.GetStringSelection())
        
        # ABA 3: ORQUESTRAÇÃO
        self.config.set("orchestration", "max_cloud_tasks", self.spin_cloud.GetValue())
        self.config.set("orchestration", "max_local_tasks", self.spin_local.GetValue())
        self.config.set("ui", "dynamic_grid", self.chk_dynamic_grid.GetValue())
        self.config.set("orchestration", "resume_tasks", self.chk_resume.GetValue())
        
        # Sincronização Atômica
        self.config.save()
        self.config.update_physical_files()
        
        logger.info("Governança atualizada e sincronizada globalmente (Deep Saneamento).")
        self.EndModal(wx.ID_OK)
    
    def on_abort_all(self, event):
        """[PHASE_5_12] Cancela tudo via Processor."""
        from core.processor import Processor
        proc = Processor()
        proc.clear_queue()
        wx.MessageBox("Comando de purga enviado. Todos os itens não concluídos foram removidos.", 
                      "Cancelamento Atômico", wx.OK | wx.ICON_INFORMATION)

    def __del__(self):
        if hasattr(self, 'timer') and self.timer.IsRunning():
            self.timer.Stop()
