# contextflow/ui/app_window.py
import wx
from core.pubsub import PubSub
from constants import APP_NAME, APP_VERSION
from core.app_state import AppState

# Importação das novas entidades segregadas (Fase 5.7)
from ui.tab_batch import TabBatch
from ui.tab_analysis import TabAnalysis
from ui.panel_detail import DetailPanel
from ui.panel_console import ConsolePanel
from ui.sidebar import Sidebar

class AppWindow(wx.Frame):
    """
    MAESTRO DA TOPOLOGIA (Fase 5.7)
    Integra as abas sob o protocolo [ZERO KNOWLEDGE].
    """
    def __init__(self, parent=None):
        super().__init__(parent, title=f"{APP_NAME} v{APP_VERSION}", size=(1280, 850))
        self.app_state = AppState()
        
        # [SSOT] Reconexão Lógica: Instanciamento e Início do Motor de Processamento
        from core.processor import Processor
        self.processor = Processor(self.app_state)
        self.processor.start_processing()
        
        self._init_ui()
        self._init_status_bar()
        self._bind_events()
        
        self.Maximize()
        self.Show(True)
        self.log_to_console("Sistema iniciado sob a Lei da Estabilidade (Fase 5.7).", "SYSTEM")

    def _init_ui(self):
        # 1. Splitter Principal (Vertical: Sidebar | Workspace+Console)
        self.main_splitter = wx.SplitterWindow(self, style=wx.SP_BORDER | wx.SP_LIVE_UPDATE)
        self.main_splitter.SetMinimumPaneSize(50) # [REVERSIBILIDADE v5.9]
        
        # 1.1 Sidebar (Esquerda)
        self.sidebar = Sidebar(self.main_splitter, self.on_sidebar_selection, app_state=self.app_state)
        
        # 1.2 Container da Área Direita (Splitter Horizontal: Notebook | Console)
        self.right_splitter = wx.SplitterWindow(self.main_splitter, style=wx.SP_BORDER | wx.SP_LIVE_UPDATE)
        self.right_splitter.SetMinimumPaneSize(50) # [REVERSIBILIDADE v5.9]
        
        # 2. Notebook (Topologia de 3 Abas conforme ARCHITECTURE.md)
        self.notebook = wx.Notebook(self.right_splitter)
        
        # Aba 1: Doca de Carga (Ingestão Massiva)
        self.tab_batch = TabBatch(self.notebook)
        # Aba 2: Cockpit Analítico (Master-Detail com Debouncing)
        self.tab_analysis = TabAnalysis(self.notebook)
        # Aba 3: Leitura Imersiva (Visualização de Conteúdo Bruto)
        self.panel_detail = DetailPanel(self.notebook)
        
        self.notebook.AddPage(self.tab_batch, "Aba 1: Doca de Carga")
        self.notebook.AddPage(self.tab_analysis, "Aba 2: Cockpit Analítico")
        self.notebook.AddPage(self.panel_detail, "Aba 3: Leitura Imersiva")
        
        # 3. Console de Logs (Inferior)
        self.panel_console = ConsolePanel(self.right_splitter)
        
        # Configuração dos Splitters
        self.right_splitter.SplitHorizontally(self.notebook, self.panel_console, -150)
        self.right_splitter.SetSashGravity(1.0) # Console fixo na base
        
        self.main_splitter.SplitVertically(self.sidebar, self.right_splitter, 250)
        
        self.create_menubar()

    def _init_status_bar(self):
        """Implementa o Indicador Visual Global mandatário [2, 3]."""
        self.CreateStatusBar(3)
        self.SetStatusWidths([-1, 200, 150])
        self.SetStatusText("Ready: SSoT Fase 5.7 Ativa", 0)
        self.SetStatusText("RAM: < 200MB (Alvo)", 1)
        self.SetStatusText("VIRTUALIZAÇÃO: OK", 2)

    def _bind_events(self):
        # Escuta sinais globais via PubSub para o StatusBar [3, 7]
        PubSub.subscribe('TASK_PROGRESS', self.on_global_progress)
        PubSub.subscribe('TASK_ERROR', self.on_global_error)
        PubSub.subscribe('TASK_QUEUED', self.on_task_queued)

    def create_menubar(self):
        menubar = wx.MenuBar()
        
        # Menu Arquivo
        file_menu = wx.Menu()
        file_menu.Append(wx.ID_EXIT, "Sair", "Encerrar aplicação")
        menubar.Append(file_menu, "&Arquivo")
        
        # Menu Exibir (Controle de Visibilidade conforme US05)
        view_menu = wx.Menu()
        self.item_view_sidebar = view_menu.AppendCheckItem(2000, "Exibir Sidebar (Histórico)")
        self.item_view_sidebar.Check(True)
        
        self.item_view_logs = view_menu.AppendCheckItem(2001, "Exibir Logs/Console")
        self.item_view_logs.Check(True)
        menubar.Append(view_menu, "&Exibir")
        
        # Menu Ferramentas
        tools_menu = wx.Menu()
        tools_menu.Append(3001, "Reprocessar Erros", "Tenta processar vídeos com status de erro")
        menubar.Append(tools_menu, "&Ferramentas")
        
        self.SetMenuBar(menubar)
        self.Bind(wx.EVT_MENU, self.on_toggle_sidebar, id=2000)
        self.Bind(wx.EVT_MENU, self.on_toggle_logs, id=2001)
        self.Bind(wx.EVT_MENU, self.on_reprocess_errors, id=3001)

    def on_global_progress(self, video_id, status_msg):
        """Atualiza o indicador de status persistente em todas as abas [3]."""
        wx.CallAfter(self.SetStatusText, f"Carga: {video_id} - {status_msg}", 0)

    def on_global_error(self, video_id, error_msg):
        """Alerta global sobre falhas (ex: Banimentos IP 429) [THREAD SAFETY]."""
        wx.CallAfter(self.SetStatusText, f"ERRO: {error_msg}", 0)
        self.log_to_console(f"Falha detectada em {video_id}: {error_msg}", "ERROR")

    def on_task_queued(self, uuid, url):
        """Notifica o enfileiramento no console para auditoria [5.8]."""
        self.log_to_console(f"Vídeo enfileirado: {url} (UUID: {uuid[:8]})", "INFO")

    def on_sidebar_selection(self, video_id):
        """Foca na Aba 3 e carrega os detalhes (Carga sob Demanda) [8]."""
        video_meta = self.app_state.get_video(video_id)
        transcript_data = self.app_state.db_handler.get_transcript(video_id)
        
        if video_meta and transcript_data:
            self.panel_detail.load_video(video_meta, transcript_data['full_text'])
            self.notebook.SetSelection(2) # Muda para Aba 3

    def log_to_console(self, msg, level="INFO"):
        self.panel_console.log(msg, level)

    def on_toggle_sidebar(self, event):
        if self.item_view_sidebar.IsChecked():
            self.main_splitter.SplitVertically(self.sidebar, self.right_splitter, 250)
        else:
            self.main_splitter.Unsplit(self.sidebar)

    def on_toggle_logs(self, event):
        if self.item_view_logs.IsChecked():
            self.right_splitter.SplitHorizontally(self.notebook, self.panel_console, -150)
        else:
            self.right_splitter.Unsplit(self.panel_console)

    def on_reprocess_errors(self, event):
        """Busca erros no AppState e reinicia o fluxo via PubSub [9]."""
        all_videos = self.app_state.get_all_videos()
        error_urls = [v['url'] for v in all_videos if v.get('status') == 'ERROR']
        
        if error_urls and wx.MessageBox(f"Reprocessar {len(error_urls)} erros?", "Confirmação", wx.YES_NO) == wx.YES:
            # [SSOT] Uso do barramento interno unificado
            PubSub.publish('REQUEST_BATCH_PROCESSING', raw_text="\n".join(error_urls))