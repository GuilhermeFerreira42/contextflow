# contextflow/ui/tab_batch.py
import wx
from pubsub import pub
from core.app_state import AppState

class TabBatch(wx.Panel):
    """
    ABA 1: Doca de Carga (Batch Ingestion)
    Dedicada à entrada massiva de URLs com prioridade de CPU.
    Protocolo: Zero-Knowledge (não importa outras abas).
    """
    def __init__(self, parent):
        super().__init__(parent)
        self.app_state = AppState()
        self._init_ui()
        self._bind_events()

    def _init_ui(self):
        # Layout estático baseado em wx.BoxSizer conforme PHASE_5_7_SPECS
        sizer = wx.BoxSizer(wx.VERTICAL)

        # Header
        lbl = wx.StaticText(self, label="Aba 1: Ingestão de Lote (Doca de Carga)")
        font = lbl.GetFont()
        font.SetWeight(wx.FONTWEIGHT_BOLD)
        font.SetPointSize(11)
        lbl.SetFont(font)
        sizer.Add(lbl, 0, wx.ALL, 10)

        # Instruções
        instr = wx.StaticText(self, label="Cole as URLs do YouTube abaixo (uma por linha):")
        sizer.Add(instr, 0, wx.LEFT | wx.RIGHT | wx.BOTTOM, 10)

        # Área de Input Massivo
        self.txt_input = wx.TextCtrl(self, style=wx.TE_MULTILINE, size=(-1, 180))
        self.txt_input.SetHint("Ex: https://www.youtube.com/watch?v=... ou link de playlist")
        sizer.Add(self.txt_input, 0, wx.EXPAND | wx.LEFT | wx.RIGHT, 10)

        # Botões de Ação
        btn_sizer = wx.BoxSizer(wx.HORIZONTAL)
        self.btn_clear = wx.Button(self, label="Limpar Lista", size=(120, 35))
        self.btn_process = wx.Button(self, label="PROCESSAR FILA", size=(150, 35))
        self.btn_process.SetBackgroundColour(wx.Colour(0, 120, 215)) # Accent Color
        self.btn_process.SetForegroundColour(wx.WHITE)
        
        btn_sizer.Add(self.btn_clear, 0, wx.RIGHT, 5)
        btn_sizer.Add(self.btn_process, 0)
        sizer.Add(btn_sizer, 0, wx.ALIGN_RIGHT | wx.ALL, 10)

        # Lista de Status de Ingestão (Feedback de Fila)
        # Exibe apenas [Status | URL | Mensagem] conforme specs
        lbl_status = wx.StaticText(self, label="Progresso da Ingestão:")
        sizer.Add(lbl_status, 0, wx.LEFT | wx.BOTTOM, 5)
        
        self.lst_status = wx.ListBox(self, style=wx.LB_SINGLE | wx.LB_HSCROLL)
        sizer.Add(self.lst_status, 1, wx.EXPAND | wx.LEFT | wx.RIGHT | wx.BOTTOM, 10)

        self.SetSizer(sizer)

    def _bind_events(self):
        self.btn_process.Bind(wx.EVT_BUTTON, self.on_click_process)
        self.btn_clear.Bind(wx.EVT_BUTTON, lambda e: self.txt_input.Clear())
        
        # Inscrição em eventos de progresso via PubSub
        pub.subscribe(self.on_task_queued, 'TASK_QUEUED')
        pub.subscribe(self.on_task_progress, 'TASK_PROGRESS')
        pub.subscribe(self.on_task_error, 'TASK_ERROR')

    def on_click_process(self, event):
        raw_text = self.txt_input.GetValue().strip()
        if not raw_text:
            wx.MessageBox("A lista de URLs está vazia.", "Aviso", wx.OK | wx.ICON_INFORMATION)
            return

        # Comunicação indireta via evento para o Processor (através da AppWindow/Main)
        # Mantém o desacoplamento Zero-Knowledge
        pub.sendMessage('REQUEST_BATCH_PROCESSING', urls=raw_text)
        self.txt_input.Clear()
        self.lst_status.Append(f"[{wx.DateTime.Now().FormatTime()}] Lote enviado para processamento...")

    def on_task_queued(self, uuid, url):
        wx.CallAfter(self.lst_status.Append, f"Na Fila: {url}")

    def on_task_progress(self, video_id, status_msg):
        wx.CallAfter(self.lst_status.Append, f"Processando {video_id}: {status_msg}")

    def on_task_error(self, video_id, error_msg):
        wx.CallAfter(self.lst_status.Append, f"ERRO {video_id}: {error_msg}")