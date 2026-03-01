# contextflow/ui/components/telemetry_strip.py
import wx
from core.theme_manager import ThemeManager
from core.pubsub import PubSub

class TelemetryStrip(wx.Panel):
    """
    Linha de Metadados imutáveis (Fase 6.1.1).
    Exibe: [ 🤖 Modelo | 🪙 Tokens | 💸 Custo Est. ]
    Localizada no topo do SummaryPanel.
    """
    def __init__(self, parent):
        super().__init__(parent)
        self.theme = ThemeManager()
        self.SetBackgroundColour(self.theme.COLOR_SECONDARY)
        self.SetMinSize((-1, 32))
        
        self._init_ui()
        
        # Inscrição para atualizações de metadados de IA
        PubSub.subscribe('SUMMARY_META_UPDATED', self.on_meta_update)
        PubSub.subscribe('SUMMARY_STARTED', self.on_summary_started)

    def _init_ui(self):
        self.sizer = wx.BoxSizer(wx.HORIZONTAL)
        
        # Estilo de Fonte (Compacto e Profissional)
        font = wx.Font(8, wx.FONTFAMILY_DEFAULT, wx.FONTSTYLE_NORMAL, wx.FONTWEIGHT_BOLD)
        
        self.lbl_model = wx.StaticText(self, label="🤖 MODELO: ---")
        self.lbl_tokens = wx.StaticText(self, label="🪙 TOKENS: ---")
        self.lbl_cost = wx.StaticText(self, label="💸 CUSTO EST: $0.000000")
        
        for lbl in [self.lbl_model, self.lbl_tokens, self.lbl_cost]:
            lbl.SetFont(font)
            lbl.SetForegroundColour(self.theme.COLOR_FG)
            self.sizer.Add(lbl, 0, wx.CENTER | wx.LEFT | wx.RIGHT, 15)
            
        self.sizer.AddStretchSpacer()
        
        # Indicador de Sessão (Opcional, mas útil para o Analista Solo)
        self.lbl_session = wx.StaticText(self, label="SESSÃO: $0.00")
        self.lbl_session.SetFont(font)
        self.lbl_session.SetForegroundColour(self.theme.COLOR_ACCENT)
        self.sizer.Add(self.lbl_session, 0, wx.CENTER | wx.RIGHT, 15)
        
        self.SetSizer(self.sizer)

    def on_summary_started(self, video_id):
        """Reseta indicadores ao iniciar nova análise."""
        wx.CallAfter(self._update_labels, "PROCESSANDO...", "...", "...")

    def on_meta_update(self, data: dict):
        """Atualiza com dados imutáveis do CostLedger/AIService."""
        model = data.get('model_id', 'unknown').upper()
        total_tokens = data.get('tokens_prompt', 0) + data.get('tokens_completion', 0)
        cost = data.get('cost_usd', 0.0)
        session_total = data.get('session_total', 0.0)
        
        wx.CallAfter(self._update_labels, model, total_tokens, f"${cost:.6f}", f"${session_total:.4f}")

    def _update_labels(self, model, tokens, cost, session=None):
        self.lbl_model.SetLabel(f"🤖 MODELO: {model}")
        self.lbl_tokens.SetLabel(f"🪙 TOKENS: {tokens}")
        self.lbl_cost.SetLabel(f"💸 CUSTO EST: {cost}")
        if session:
            self.lbl_session.SetLabel(f"SESSÃO: {session}")
        self.Layout()
