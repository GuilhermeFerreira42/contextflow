
# contextflow/ui/app_window.py
import wx
import threading
import os
from constants import APP_NAME, APP_VERSION
from core.token_engine import get_encoder_info
from core.app_state import AppState

# Real implementations (Phase 5.7 Segregated)
from ui.tab_batch import TabBatch
from ui.tab_analysis import TabAnalysis
from ui.panel_detail import DetailPanel
from ui.panel_console import ConsolePanel
from ui.sidebar import Sidebar
from storage.db_handler import DatabaseHandler

class AppWindow(wx.Frame):
    def __init__(self, parent, title=f"{APP_NAME} v{APP_VERSION}"):
        super().__init__(parent, title=title, size=(1280, 850))
        
        # Initialize App State Singleton
        self.app_state = AppState()
        self.db_handler = self.app_state.db_handler # Shortcut for compatibility if needed
        
        self._init_ui()
        self.Maximize() # Inicia maximizado
        self.Show(True)
        
        # Log inicial
        self.panel_console.log("Sistema iniciado. Pronto.", "SYSTEM")

    def _init_ui(self):
        # 1. Main Splitter (Vertical: Sidebar | Workspace+Console)
        # [LAYOUT] Arquitetura de Splitters aninhados permite ocultar painéis
        # para maximizar a área de leitura em monitores pequenos.
        self.main_splitter = wx.SplitterWindow(self, style=wx.SP_BORDER | wx.SP_LIVE_UPDATE)

        
        # 1.1 Sidebar (Left) - Inject AppState
        self.sidebar = Sidebar(self.main_splitter, self.on_sidebar_selection, self.on_sidebar_data_changed, app_state=self.app_state)

        # 1.2 Right Area Container (will be a Splitter too)
        self.right_splitter = wx.SplitterWindow(self.main_splitter, style=wx.SP_BORDER | wx.SP_LIVE_UPDATE)
        
        # 2. Workspace (Top Right) - Notebook
        self.notebook = wx.Notebook(self.right_splitter)
        
        # 3. Console (Bottom Right)
        self.panel_console = ConsolePanel(self.right_splitter)
        
        # 4. Criar Abas do Notebook (Phase 5.7 Topology)
        # Aba 1: Doca de Carga (Batch Ingestion)
        # Note: TabBatch is now independent and Zero-Knowledge
        self.tab_batch = TabBatch(self.notebook)
        
        # Aba 2: Cockpit Analítico (Master-Detail)
        self.tab_analysis = TabAnalysis(self.notebook)
        
        # Aba 3: Detalhes / Conteúdo
        self.panel_detail = DetailPanel(self.notebook)
        
        self.notebook.AddPage(self.tab_batch, "Dados (Batch)")
        self.notebook.AddPage(self.tab_analysis, "Tabela: Vídeos")
        self.notebook.AddPage(self.panel_detail, "Conteúdo (Leitura)")

        # Configurar Splitters
        # Right Splitter: Top (Notebook) vs Bottom (Console)
        self.right_splitter.SplitHorizontally(self.notebook, self.panel_console, -150) # 150px altura console
        self.right_splitter.SetSashGravity(1.0) # Ao redimensionar janela, console fica fixo em baixo
        self.right_splitter.SetMinimumPaneSize(100)
        
        # Main Splitter: Left (Sidebar) vs Right (Splitter2)
        self.main_splitter.SplitVertically(self.sidebar, self.right_splitter, 250) # 250px largura sidebar
        self.main_splitter.SetMinimumPaneSize(150)

        # 5. Menus e Toolbar
        self.create_menubar()
        
    def create_menubar(self):
        menubar = wx.MenuBar()
        file_menu = wx.Menu()
        file_menu.Append(wx.ID_EXIT, "Sair", "Encerrar aplicação")
        menubar.Append(file_menu, "&Arquivo")
        self.SetMenuBar(menubar)
        
        self.Bind(wx.EVT_MENU, self.on_exit, id=wx.ID_EXIT)
        self.Bind(wx.EVT_CLOSE, self.on_close)

        # View Menu
        view_menu = wx.Menu()
        self.item_view_logs = view_menu.AppendCheckItem(2001, "Exibir Logs/Console")
        self.item_view_logs.Check(True) # Default True
        menubar.Append(view_menu, "&Exibir")
        
        self.Bind(wx.EVT_MENU, self.on_toggle_logs, id=2001)

        # Tools Menu
        tools_menu = wx.Menu()
        tools_menu.Append(3001, "Reprocessar Erros", "Tenta baixar novamente vídeos com status de erro")
        menubar.Append(tools_menu, "&Ferramentas")
        
        self.Bind(wx.EVT_MENU, self.on_reprocess_errors, id=3001)

    # --- Callbacks e Lógica ---

    def on_toggle_logs(self, event):
        show = self.item_view_logs.IsChecked()
        if show:
            self.panel_console.Show()
            self.right_splitter.SplitHorizontally(self.notebook, self.panel_console, -150)
        else:
            self.panel_console.Hide()
            self.right_splitter.Unsplit(self.panel_console)
        self.right_splitter.Layout()

    def log_to_console(self, msg, level="INFO"):
        self.panel_console.log(msg, level)

    def on_sidebar_selection(self, video_id):
        """Ao selecionar na árvore, focar na aba de Leitura e carregar."""
        # [CARGA SOB DEMANDA] Buscamos a transcrição pesada (blob) apenas no clique.
        # Isso economiza RAM, evitando carregar megabytes de texto de todos os vídeos na inicialização.
        # Carrega dados via AppState
        video_meta = self.app_state.get_video(video_id)

        transcript_data = self.app_state.db_handler.get_transcript(video_id)
        
        if video_meta and transcript_data:
            self.panel_detail.load_video(video_meta, transcript_data['full_text'])
            # Muda para a aba de conteúdo
            self.notebook.SetSelection(2) # Index 2 is Detail
            self.log_to_console(f"Visualizando: {video_meta.get('title')}", "NAV")

    def on_grid_data_changed(self):
        """Chamado quando há novos dados/processamento."""
        self.sidebar.load_history()
        # A atualização da Grid agora é via PubSub no TabAnalysis

    def on_table_selection(self, video_id):
        # Reuse logic
        self.on_sidebar_selection(video_id)

    def on_sidebar_data_changed(self, action=None, affected_ids=None):
        """Called when data is changed."""
        # Com AppState e PubSub, a sincronização é automática nas abas.
        # Forçamos apenas o reload do sidebar por enquanto.
        self.sidebar.load_history()

    def on_exit(self, event):
        self.Close()
        
    def on_close(self, event):
        # O encerramento seguro será gerenciado pelo AppState ou Processor central
        event.Skip()

    def on_reprocess_errors(self, event):
        """Busca vídeos com erro no AppState e re-enfileira."""
        all_videos = self.app_state.get_all_videos()
        error_urls = [v['url'] for v in all_videos if v.get('status') == 'ERROR']
        
        if not error_urls:
            wx.MessageBox("Nenhum vídeo com erro encontrado.", "Info")
            return
            
        confirm = wx.MessageBox(f"Encontrados {len(error_urls)} vídeos com erro. Deseja tentar novamente?", "Confirmação", wx.YES_NO | wx.ICON_QUESTION)
        
        if confirm == wx.YES:
            # Lógica de reprocessamento será centralizada no Processor
            self.log_to_console(f"Reiniciando processamento de {len(error_urls)} itens.", "SYSTEM")
