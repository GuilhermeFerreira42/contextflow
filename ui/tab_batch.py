import wx
from pubsub import pub

class TabBatch(wx.Panel):
    """
    ABA 1: Doca de Carga (Batch Ingestion)
    Dedicada à entrada massiva de URLs. 
    Zero-Knowledge: Comunicação via AppState e PubSub.
    """
    def __init__(self, parent):
        super().__init__(parent)
        self._init_ui()
        self._bind_events()

    def _init_ui(self):
        sizer = wx.BoxSizer(wx.VERTICAL)
        
        # Header
        lbl = wx.StaticText(self, label="Aba 1: Ingestão de Lote (Doca de Carga)")
        font = lbl.GetFont()
        font.SetWeight(wx.FONTWEIGHT_BOLD)
        lbl.SetFont(font)
        sizer.Add(lbl, 0, wx.ALL, 10)
        
        # Input Area (Placeholder para Processor integration)
        self.txt_input = wx.TextCtrl(self, style=wx.TE_MULTILINE, size=(-1, 150))
        sizer.Add(self.txt_input, 0, wx.EXPAND | wx.ALL, 5)
        
        self.btn_process = wx.Button(self, label="Processar Fila")
        sizer.Add(self.btn_process, 0, wx.ALIGN_RIGHT | wx.ALL, 5)
        
        # Feedback List (Placeholder)
        self.lst_status = wx.ListBox(self)
        sizer.Add(self.lst_status, 1, wx.EXPAND | wx.ALL, 5)
        
        self.SetSizer(sizer)

    def _bind_events(self):
        self.btn_process.Bind(wx.EVT_BUTTON, self.on_click_process)

    def on_click_process(self, event):
        # Enviar URLs para o Processor via Singleton ou Evento
        pass
