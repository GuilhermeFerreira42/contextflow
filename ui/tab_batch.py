
# contextflow/ui/tab_batch.py
import wx
import wx.dataview as dv
from core.processor import Processor
from storage.db_handler import DatabaseHandler

class BatchTab(wx.Panel):
    def __init__(self, parent):
        super().__init__(parent)
        self.processor = Processor()
        self.db_handler = DatabaseHandler()
        
        # Conecta callbacks do processador
        self.processor.on_task_update = self.on_task_update
        self.processor.on_task_complete = self.on_task_complete
        self.processor.on_error = self.on_task_error
        
        self.processor.start_processing() # Inicia thread de worker
        
        self._init_ui()
        self.load_data()

    def _init_ui(self):
        main_sizer = wx.BoxSizer(wx.VERTICAL)
        
        # 1. Área de Input (Topo)
        input_sizer = wx.StaticBoxSizer(wx.VERTICAL, self, "Entrada de Links (Vídeos ou Playlists - Um por linha)")
        self.txt_input = wx.TextCtrl(self, style=wx.TE_MULTILINE, size=(-1, 100))
        input_sizer.Add(self.txt_input, 1, wx.EXPAND | wx.ALL, 5)
        
        btn_sizer = wx.BoxSizer(wx.HORIZONTAL)
        self.btn_process = wx.Button(self, label="Adicionar à Fila e Processar", size=(180, 40))
        self.btn_process.Bind(wx.EVT_BUTTON, self.on_click_process)
        
        self.btn_clear_input = wx.Button(self, label="Limpar Input", size=(180, 40))
        self.btn_clear_input.Bind(wx.EVT_BUTTON, lambda e: self.txt_input.Clear())

        btn_sizer.Add(self.btn_process, 0, wx.RIGHT, 5)
        btn_sizer.Add(self.btn_clear_input, 0)
        
        input_sizer.Add(btn_sizer, 0, wx.EXPAND | wx.ALL, 5)
        main_sizer.Add(input_sizer, 0, wx.EXPAND | wx.ALL, 5)

        # 2. Tabela de Resultados (Centro)
        self.dvc = dv.DataViewListCtrl(self)
        self.dvc.AppendTextColumn("ID", width=100)
        self.dvc.AppendTextColumn("Título", width=300)
        self.dvc.AppendTextColumn("Status", width=100)
        self.dvc.AppendTextColumn("Tokens", width=80)
        self.dvc.AppendTextColumn("Data", width=150)
        
        # Estilização básica alternada (se suportado pelo SO)
        self.dvc.SetMinSize((400, 300))
        
        main_sizer.Add(self.dvc, 1, wx.EXPAND | wx.ALL, 5)
        
        # 3. Rodapé de Ações em Massa
        action_sizer = wx.BoxSizer(wx.HORIZONTAL)
        self.btn_export = wx.Button(self, label="Exportar Selecionados (Markdown/ZIP)")
        self.btn_export.Bind(wx.EVT_BUTTON, self.on_export)
        
        self.lbl_status = wx.StaticText(self, label="Pronto.")
        
        action_sizer.Add(self.lbl_status, 1, wx.ALIGN_CENTER_VERTICAL)
        action_sizer.Add(self.btn_export, 0, wx.ALIGN_CENTER_VERTICAL)
        
        main_sizer.Add(action_sizer, 0, wx.EXPAND | wx.ALL, 5)
        
        self.SetSizer(main_sizer)

    def load_data(self):
        """Carrega dados do banco na tabela."""
        self.dvc.DeleteAllItems()
        videos = self.db_handler.get_all_videos()
        for v in videos:
            self.dvc.AppendItem([
                v['id'],
                v['title'],
                v['status'],
                str(v['token_count']),
                v['created_at']
            ])

    def on_click_process(self, event):
        raw_text = self.txt_input.GetValue()
        if not raw_text.strip():
            wx.MessageBox("Cole pelo menos uma URL.", "Aviso", wx.ICON_WARNING)
            return
            
        self.lbl_status.SetLabel("Enfileirando tarefas...")
        self.processor.add_urls(raw_text)
        self.txt_input.Clear()
        self.lbl_status.SetLabel("Processamento iniciado em segundo plano.")

    def on_task_update(self, video_id, status):
        """Chamado pelo Processor via wx.CallAfter"""
        self.lbl_status.SetLabel(f"[{video_id}] {status}")
        # O ideal seria atualizar a linha específica na tabela, mas por simplicidade recarregamos
        # Em produção, usaríamos um DataViewModel real para updates parciais rápidos.
        self.load_data() 

    def on_task_complete(self, data):
        self.lbl_status.SetLabel(f"Concluído: {data['title']}")
        wx.MessageBox(f"Processamento concluído: {data['title']}", "Sucesso", wx.ICON_INFORMATION)
        self.load_data()

    def on_task_error(self, video_id, error_msg):
        self.lbl_status.SetLabel(f"Erro [{video_id}]: {error_msg}")
        self.load_data()

    def on_export(self, event):
        selection = self.dvc.GetSelections() # Retorna objetos DataViewItem
        if not selection:
            wx.MessageBox("Selecione pelo menos um vídeo na tabela.", "Aviso")
            return
        
        # Mapeia seleção para IDs
        # DataViewListCtrl é simples, mas recuperar dados da seleção requer index mapping
        # Como hack rápido, vamos pegar TODOS por enquanto ou melhorar isso
        # DataViewListCtrl.ItemToRow(item)
        
        selected_ids = []
        for item in selection:
            row = self.dvc.ItemToRow(item)
            val = self.dvc.GetValue(row, 0) # Coluna 0 é ID
            selected_ids.append(val)
            
        if not selected_ids: return

        zip_path = self.processor.export_data(selected_ids, "markdown")
        
        if zip_path:
            wx.MessageBox(f"Exportação concluída!\nArquivo salvo em:\n{zip_path}", "Sucesso")
            # Abre a pasta (Windows)
            import subprocess
            subprocess.Popen(f'explorer /select,"{zip_path}"')
        else:
            wx.MessageBox("Erro na exportação.", "Erro", wx.ICON_ERROR)
